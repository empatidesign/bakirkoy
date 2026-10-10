using System.Text.Json;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.ParticipantLibraries;
using Nexora.Application.Features.ParticipantLibraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class ParticipantLibraryService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IAuditService audit,
    IActivityLogger log,
    ILibraryOperationsService libraryOps,
    ILibrarySettingsService settings,
    IEmanetService emanet,
    ITemplateRuleEngine templateEngine,
    Microsoft.Extensions.Configuration.IConfiguration config) : IParticipantLibraryService
{
    public async Task<PagedResult<CitizenLibraryDto>> DiscoverAsync(CitizenLibraryDiscoverParams p, CancellationToken ct)
    {
        var pagedResult = await uow.Libraries.DiscoverPagedAsync(p, ct);
        var paged = pagedResult.Items;

        var libraryIds = paged.Select(l => l.Id).ToList();
        var occupiedByLibrary = await uow.LibrarySessions.CountInsideByLibrariesAsync(libraryIds, ct);
        var onBreakByLibrary = await uow.LibrarySessions.CountOnBreakByLibrariesAsync(libraryIds, ct);
        var waitingByLibrary = await uow.LibraryQueue.CountWaitingByLibrariesAsync(libraryIds, ct);
        // Bulgu (2026-09-23, staj testi): vatandaş bir koltuk/yer ayırttığında ("held"
        // rezervasyon/walk-in) liste ekranındaki doluluk hiç değişmiyordu — yalnızca
        // fiziksel giriş (LibrarySessions) sayılıyordu. "Held" tutmalar da kapasiteden
        // düşülmeli; aksi halde kullanıcı yer ayırtsa da kart "boş" göstermeye devam eder.
        var heldByLibrary = await uow.LibraryReservations.CountHeldByLibrariesAsync(libraryIds, ct);

        var facilityIds = paged.Select(l => l.ServiceFacilityId).Distinct().ToList();
        var facilities = await uow.ServiceFacilities.FindAsync(f => facilityIds.Contains(f.Id), ct);
        var coordsByFacility = facilities.ToDictionary(f => f.Id, f => (f.Latitude, f.Longitude));

        var items = paged.Select(l =>
        {
            var sessionOccupied = occupiedByLibrary.GetValueOrDefault(l.Id);
            var onBreak = onBreakByLibrary.GetValueOrDefault(l.Id);
            var held = heldByLibrary.GetValueOrDefault(l.Id);
            var occupied = sessionOccupied + held;
            var inside = Math.Max(0, occupied - onBreak);
            var waiting = waitingByLibrary.GetValueOrDefault(l.Id);
            var occupancyRate = l.Capacity > 0 ? Math.Round((double)inside / l.Capacity * 100, 0) : 0;
            coordsByFacility.TryGetValue(l.ServiceFacilityId, out var coords);
            return new CitizenLibraryDto(
                l.Id, l.Name, l.ImageUrl, l.District, l.City, l.Address,
                l.Capacity, l.FloorCount, l.Amenities, l.ManagerPhone,
                l.SeatingMode, l.AccessType, l.DeviceKind, l.ReservationEnabled, l.QueueEnabled,
                inside, onBreak, Math.Max(0, l.Capacity - occupied), waiting,
                coords.Latitude, coords.Longitude, l.AreaType, occupancyRate, l.EntryControlMode);
        }).ToList();

        return new PagedResult<CitizenLibraryDto>
        {
            Items = items,
            Total = pagedResult.Total,
            Page = pagedResult.Page,
            Limit = pagedResult.Limit,
        };
    }

    private static readonly Dictionary<string, string> AreaTypeLabels = new()
    {
        ["study"] = "Çalışma Alanı",
        ["silent"] = "Sessiz Alan",
        ["mixed"] = "Karma",
    };

    private static readonly Dictionary<string, string> SeatingModeLabels = new()
    {
        ["masali"] = "Masalı",
        ["sirali"] = "Sıralı",
    };

    /// <summary>Bilinen olanak anahtarları; listede olmayan ham değer gösterilir.</summary>
    private static readonly Dictionary<string, string> AmenityLabels = new()
    {
        ["wifi"] = "Wi-Fi",
        ["cafe"] = "Kafeterya",
        ["printer"] = "Yazıcı",
        ["parking"] = "Otopark",
        ["disabled_access"] = "Engelli Erişimi",
        ["locker"] = "Dolap",
    };

    /// <summary>Erişim tipi etiketleri (portal getAccessTypeLabel ile aynı).</summary>
    private static readonly Dictionary<string, string> AccessTypeLabels = new()
    {
        ["open"] = "Serbest Kullanım",
        ["device"] = "QR ile Geçiş",
        ["qr"] = "QR Girişli",
    };

    public async Task<CitizenLibraryFiltersDto> GetFiltersAsync(CitizenLibraryDiscoverParams p, CancellationToken ct)
    {
        var all = await uow.Libraries.GetActiveAsync(ct);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = p.Search.Trim();
            all = all.Where(l =>
                l.Name.ContainsIgnoreCaseTr(t)
                || l.District.ContainsIgnoreCaseTr(t)
                || l.City.ContainsIgnoreCaseTr(t)
                || l.Address.ContainsIgnoreCaseTr(t)).ToList();
        }

        var areaTypes = all
            .GroupBy(l => l.AreaType)
            .OrderBy(g => g.Key)
            .Select(g => new CitizenLibraryAreaOptionDto(
                g.Key,
                AreaTypeLabels.GetValueOrDefault(g.Key, g.Key),
                g.Count()))
            .ToList();

        var districts = all
            .Where(l => !string.IsNullOrWhiteSpace(l.District))
            .GroupBy(l => l.District!)
            .OrderBy(g => g.Key)
            .Select(g => new CitizenLibraryAreaOptionDto(g.Key, g.Key, g.Count()))
            .ToList();

        var accessTypes = all
            .GroupBy(l => l.AccessType)
            .OrderBy(g => g.Key)
            .Select(g => new CitizenLibraryAreaOptionDto(
                g.Key,
                AccessTypeLabels.GetValueOrDefault(g.Key, g.Key),
                g.Count()))
            .ToList();

        var ids = all.Select(l => l.Id).ToList();
        var occupied = await uow.LibrarySessions.CountInsideByLibrariesAsync(ids, ct);
        var availableCount = all.Count(l => l.Capacity <= 0 || occupied.GetValueOrDefault(l.Id) < l.Capacity);
        var reservableCount = all.Count(l => l.ReservationEnabled);
        var queueEnabledCount = all.Count(l => l.QueueEnabled);

        var seatingModes = all
            .GroupBy(l => l.SeatingMode)
            .OrderBy(g => g.Key)
            .Select(g => new CitizenLibraryAreaOptionDto(
                g.Key,
                SeatingModeLabels.GetValueOrDefault(g.Key, g.Key),
                g.Count()))
            .ToList();

        var amenities = all
            .SelectMany(l => l.Amenities)
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .GroupBy(a => a)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Select(g => new CitizenLibraryAreaOptionDto(
                g.Key,
                AmenityLabels.GetValueOrDefault(g.Key, g.Key),
                g.Count()))
            .ToList();

        return new CitizenLibraryFiltersDto(
            areaTypes, all.Count, availableCount,
            districts, accessTypes, reservableCount,
            seatingModes, amenities, queueEnabledCount);
    }

    public async Task<CitizenLibraryDetailDto> GetDetailAsync(Guid libraryId, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        if (library is null || !library.IsActive)
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");

        var rules = (await uow.LibraryRules.FindAsync(
                r => (r.LibraryId == libraryId || r.LibraryId == null) && r.IsActive, ct))
            .OrderBy(r => r.Category).ThenBy(r => r.Title)
            .Select(r => new CitizenLibraryRuleDto(r.Id, r.Category, r.Title, r.Description, r.Icon, r.Severity))
            .ToList();

        var s = await settings.GetAsync(libraryId, ct);

        var serviceFacility = await uow.ServiceFacilities.GetByIdAsync(library.ServiceFacilityId, ct);
        int? parkingCapacity = serviceFacility?.ParkingCapacity is > 0 ? serviceFacility.ParkingCapacity : null;
        string? parkingType = parkingCapacity is not null ? serviceFacility!.ParkingType.ToString() : null;

        string? nearestEmergencyAreaName = null;
        double? nearestEmergencyAreaDistanceKm = null;
        if (library.GeofenceLatitude.HasValue && library.GeofenceLongitude.HasValue)
        {
            var emergencyAreas = await uow.EmergencyAreas.GetActiveAsync(ct);
            var nearest = emergencyAreas
                .Where(e => e.Latitude.HasValue && e.Longitude.HasValue)
                .Select(e => (Area: e, Km: HaversineKm(library.GeofenceLatitude.Value, library.GeofenceLongitude.Value, e.Latitude!.Value, e.Longitude!.Value)))
                .OrderBy(x => x.Km)
                .FirstOrDefault();
            if (nearest.Area is not null)
            {
                nearestEmergencyAreaName = nearest.Area.Name;
                nearestEmergencyAreaDistanceKm = Math.Round(nearest.Km, 2);
            }
        }

        return new CitizenLibraryDetailDto(
            library.Id,
            library.Name,
            library.ImageUrl,
            library.Description,
            library.District,
            library.City,
            library.Address,
            library.Capacity,
            library.FloorCount,
            library.IsMultiFloor,
            library.Amenities,
            library.ManagerPhone,
            library.EmergencyPhone,
            library.SeatingMode,
            library.AccessType,
            library.DeviceKind,
            library.ReservationEnabled,
            library.QueueEnabled,
            s.ReservationHoldWindowMinutes,
            s.MaxSessionMinutes > 0 ? s.MaxSessionMinutes : (s.MaxStudyHoursPerDay > 0 ? s.MaxStudyHoursPerDay * 60 : 0),
            s.BreakDurationMinutes,
            s.LongBreakDurationMinutes,
            s.MaxDailyBreaks,
            s.MaxDailyLongBreaks,
            s.ShortBreakCooldownMinutes,
            s.BreakReturnGraceMinutes,
            rules,
            library.StaticQrEnabled,
            parkingCapacity,
            parkingType,
            nearestEmergencyAreaName,
            nearestEmergencyAreaDistanceKm,
            library.GeofenceLatitude,
            library.GeofenceLongitude,
            library.EntryControlMode,
            library.StaticQrMode);
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLon = (lon2 - lon1) * Math.PI / 180.0;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    public async Task<CitizenLibrarySeatPlanDto> GetSeatPlanAsync(Guid libraryId, DateTime? date, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        if (library is null || !library.IsActive)
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");

        var plan = await libraryOps.GetSeatPlanAsync(libraryId, ct);

        var floors = plan.Floors.Select(ToCitizenFloor).ToList();
        return new CitizenLibrarySeatPlanDto(plan.SeatingMode, floors);
    }

    private static CitizenLibraryFloorDto ToCitizenFloor(SeatFloorDto f)
        => new(
            f.Id,
            f.Name,
            f.Capacity,
            f.KrokiUrl,
            (f.Seats ?? []).Select(ToCitizenSeat).ToList(),
            f.Sections?.Select(ToCitizenSection).ToList());

    private static CitizenLibrarySeatSectionDto ToCitizenSection(SeatSectionDto s)
        => new(
            s.Id,
            s.Name,
            s.Type,
            s.Color,
            s.Capacity,
            (s.Tables ?? []).Select(ToCitizenTable).ToList());

    private static CitizenLibrarySeatTableDto ToCitizenTable(SeatTableDto t)
        => new(
            t.Id,
            t.Name,
            t.SeatCount,
            (t.Seats ?? []).Select(ToCitizenSeat).ToList());

    private static CitizenLibrarySeatDto ToCitizenSeat(SeatDto s)
        => new(s.Key, s.Number, s.Label, MapSeatStatus(s.Status));

    public async Task<CitizenLibraryReservationDto> ReserveAsync(Guid libraryId, CitizenLibraryReserveRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(ReserveAsync), new { libraryId, req.Seat, req.SlotStart });

        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Hesap bilgisi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.Status != ParticipantStatus.Active)
            throw new ConflictException("Hesabınız aktif değil. Lütfen belediye ile iletişime geçin.", "ACCOUNT_NOT_ACTIVE");

        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        var residencyViolation = Nexora.Domain.Common.EligibilityRules.CheckResidency(
            library.ResidencyMode, participant, null, config["Residency:SultangaziDistrictCode"] ?? Nexora.Domain.Common.ResidencyPolicy.DefaultSultangaziDistrictCode);
        if (residencyViolation is not null)
            throw new ConflictException(residencyViolation.Message, residencyViolation.ErrorCode);

        var opsRequest = new LibraryReservationRequest(
            participant.Tckn,
            participant.Id.ToString(),
            participant.FullName,
            participant.Phone,
            participant.BirthDate.ToString("O"),
            participant.GuardianPhone,
            string.IsNullOrWhiteSpace(req.Seat) ? null : req.Seat.Trim(),
            req.SlotStart,
            req.SlotEnd);

        var result = await libraryOps.CreateReservationAsync(libraryId, opsRequest, ct);

        var reservationId = Guid.Parse(result.Id);
        var reservation = await uow.LibraryReservations.GetByIdAsync(reservationId, ct)
            ?? throw new NotFoundException("Rezervasyon bulunamadı.", "RESERVATION_NOT_FOUND");

        return ToReservation(reservation, library);
    }

    public async Task<PagedResult<CitizenLibraryReservationDto>> GetReservationsAsync(CitizenLibraryReservationListParams p, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var paged = await uow.LibraryReservations.GetByParticipantAsync(actorId, p.Status, p.PageResolved, p.LimitResolved, ct, p.Search);

        var libraryIds = paged.Items.Select(r => r.LibraryId).Distinct().ToList();
        var libraries = libraryIds.Count == 0
            ? new Dictionary<Guid, Library>()
            : (await uow.Libraries.FindIncludingDeletedAsync(l => libraryIds.Contains(l.Id), ct)).ToDictionary(l => l.Id);

        var items = paged.Items
            .Select(r => ToReservation(r, libraries.GetValueOrDefault(r.LibraryId)))
            .ToList();

        return new PagedResult<CitizenLibraryReservationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task CancelReservationAsync(Guid reservationId, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var reservation = await uow.LibraryReservations.GetByIdAsync(reservationId, ct)
            ?? throw new NotFoundException("Rezervasyon bulunamadı.", "RESERVATION_NOT_FOUND");

        if (reservation.ParticipantId != actorId)
            throw new ForbiddenException("Bu rezervasyona erişim yetkiniz yok.", "RESERVATION_FORBIDDEN");

        if (reservation.Status != "held")
            throw new ConflictException("Yalnızca bekleyen rezervasyonlar iptal edilebilir.", "RESERVATION_NOT_CANCELABLE");

        reservation.Cancel();
        uow.LibraryReservations.Update(reservation);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Cancel,
            Result = LogResult.Success,
            EntityType = "LibraryReservation",
            EntityId = reservation.Id,
            Module = "Library",
            Description = "Vatandaş kıraathane rezervasyonunu iptal etti",
            ActorUserId = actorId,
            ActorUserName = currentUser.Name,
        }, ct);
    }

    private static readonly JsonSerializerOptions ReservationJsonOpts = new(JsonSerializerDefaults.Web);

    private static CitizenLibraryReservationDto ToReservation(LibraryReservation r, Library? library)
    {
        var (floorName, sectionName, seatLabel) = ResolveSeat(library, r.Seat);
        return new(
            r.Id,
            r.LibraryId,
            library?.Name ?? "—",
            library?.District,
            r.Seat,
            floorName,
            sectionName,
            seatLabel,
            r.Status,
            r.ReservedAt,
            r.SlotStart,
            r.SlotEnd,
            r.HoldUntil);
    }

    private static (string? Floor, string? Section, string? SeatLabel) ResolveSeat(Library? library, string? seatKey)
    {
        if (library is null || string.IsNullOrWhiteSpace(seatKey)) return (null, null, null);
        var parts = seatKey.Split(':');
        var seatNo = parts[^1];
        LibraryLayoutDto layout;
        try
        {
            layout = string.IsNullOrWhiteSpace(library.LayoutJson)
                ? new LibraryLayoutDto(false, [])
                : JsonSerializer.Deserialize<LibraryLayoutDto>(library.LayoutJson, ReservationJsonOpts) ?? new LibraryLayoutDto(false, []);
        }
        catch { return (null, null, $"Koltuk {seatNo}"); }

        var floor = layout.Floors.FirstOrDefault(f => f.Id == parts[0]);
        if (parts.Length >= 4 && floor?.Sections is { Count: > 0 } sections)
        {
            var section = sections.FirstOrDefault(s => s.Id == parts[1]);
            // Bulgu (2026-10-02): Tables null olduğunda (LayoutJson'da section henüz
            // masa eklenmemiş) ?. yalnızca section'ı korur, .Tables null olunca
            // FirstOrDefault çağrısı yine NRE fırlatıp seat-plan/rezervasyon uçlarını
            // 500'e düşürüyordu.
            var table = section?.Tables?.FirstOrDefault(t => t.Id == parts[2]);
            var label = table is not null ? $"{table.Name} · Koltuk {seatNo}" : $"Koltuk {seatNo}";
            return (floor?.Name, section?.Name, label);
        }
        return (floor?.Name, null, $"Koltuk {seatNo}");
    }

    public async Task<PendingExitResultDto> RegisterExitIntentAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var session = await uow.LibrarySessions.GetActiveByParticipantAsync(actorId, ct)
            ?? throw new ConflictException("Aktif bir kıraathane oturumunuz bulunmuyor.", "NO_ACTIVE_SESSION");
        var windowMinutes = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ExitIntentWindowMinutes", 5);
        session.RegisterExitIntent();
        uow.LibrarySessions.Update(session);
        await uow.SaveChangesAsync(ct);
        return new PendingExitResultDto(
            session.PendingExitAt!.Value,
            windowMinutes * 60,
            $"Çıkış için {windowMinutes} dakikanız var. Lütfen bu süre içinde görevliye QR kodunuzu okutun.");
    }

    public async Task<PendingExitResultDto> RegisterBreakIntentAsync(string? type, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var session = await uow.LibrarySessions.GetActiveByParticipantAsync(actorId, ct)
            ?? throw new ConflictException("Aktif bir kıraathane oturumunuz bulunmuyor.", "NO_ACTIVE_SESSION");
        if (session.IsOnBreak)
            throw new ConflictException("Zaten moladasınız.", "ALREADY_ON_BREAK");

        var s = await settings.GetAsync(session.LibraryId, ct);
        if (!await templateEngine.IsBreakSystemEnabledAsync(session.LibraryId, ct))
            throw new ConflictException("Bu kıraathanede mola sistemi kullanılmıyor.", "BREAK_SYSTEM_DISABLED");
        if (type != "long" && s.MinEntryBeforeBreakMinutes > 0)
        {
            var elapsed = (DateTime.UtcNow - session.EntryTime).TotalMinutes;
            if (elapsed < s.MinEntryBeforeBreakMinutes)
            {
                var wait = (int)Math.Ceiling(s.MinEntryBeforeBreakMinutes - elapsed);
                throw new ConflictException($"Kısa mola için en az {s.MinEntryBeforeBreakMinutes} dakika içeride olmanız gerekiyor. Yaklaşık {wait} dakika sonra mola alabilirsiniz.", "TOO_SOON_FOR_BREAK");
            }
        }

        var windowMinutes = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ExitIntentWindowMinutes", 5);
        session.RegisterBreakIntent(type == "long" ? "long" : "short");
        uow.LibrarySessions.Update(session);
        await uow.SaveChangesAsync(ct);
        var breakLabel = type == "long" ? "Uzun mola" : "Kısa mola";
        return new PendingExitResultDto(
            DateTime.UtcNow.AddMinutes(windowMinutes),
            windowMinutes * 60,
            $"{breakLabel} için {windowMinutes} dakikanız var. Lütfen bu süre içinde okuyucuya QR kodunuzu okutun.");
    }

    public async Task<CitizenSessionDto?> GetActiveSessionAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var session = await uow.LibrarySessions.GetActiveByParticipantAsync(actorId, ct);
        if (session is null) return null;
        var library = await uow.Libraries.GetByIdAsync(session.LibraryId, ct);
        return await BuildSessionDtoAsync(session, library, ct);
    }

    public async Task<CitizenMyQueueDto?> GetMyQueueAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var entry = await uow.LibraryQueue.GetActiveByParticipantAnyAsync(actorId, ct);
        if (entry is null) return null;

        var ordered = await uow.LibraryQueue.GetActiveOrderedAsync(entry.LibraryId, ct);
        var waiting = ordered.Where(x => x.Status == "waiting").ToList();
        var pos = waiting.FindIndex(x => x.Id == entry.Id);
        var position = entry.Status == "called" ? 0 : (pos >= 0 ? pos + 1 : 0);

        int? callRemaining = entry.Status == "called" && entry.CountdownExpiresAt is DateTime exp
            ? (int)Math.Max(0, Math.Ceiling((exp - DateTime.UtcNow).TotalMinutes))
            : null;

        var library = await uow.Libraries.GetByIdAsync(entry.LibraryId, ct);
        return new CitizenMyQueueDto(
            entry.Id.ToString(), entry.LibraryId.ToString(), library?.Name ?? "",
            position, entry.Status, callRemaining, entry.QueueNumber ?? "");
    }

    // Kullanıcı isteği (2026-09-30): "Bugünkü Hareketlerim" listesi mobilde günlük/
    // haftalık/aylık sekmelere ayrıldı — sunucu tarafında zaten tutulan giriş/çıkış/
    // mola kayıtları tekrar yerelde saklanmak yerine aralığa göre buradan çekilir.
    // `range` verilmezse (eski istemciler dahil) geriye dönük uyumlu tek-gün davranışı
    // korunur (day ile aynı).
    public async Task<List<CitizenLibraryMovementDto>> GetHistoryAsync(DateTime? date, string? range, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var trOffset = TimeSpan.FromHours(3);
        var nowLocal = DateTime.UtcNow.Add(trOffset);
        var anchorLocal = (date ?? nowLocal).Date;
        DateTime fromLocal, toLocal;
        switch (range)
        {
            case "week":
                // Pazartesi başlangıçlı hafta (GetMyStatsAsync ile aynı kural).
                var weekday = anchorLocal.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)anchorLocal.DayOfWeek;
                fromLocal = anchorLocal.AddDays(-(weekday - 1));
                toLocal = fromLocal.AddDays(7);
                break;
            case "month":
                fromLocal = new DateTime(anchorLocal.Year, anchorLocal.Month, 1);
                toLocal = fromLocal.AddMonths(1);
                break;
            default:
                fromLocal = anchorLocal;
                toLocal = fromLocal.AddDays(1);
                break;
        }
        var from = DateTime.SpecifyKind(fromLocal, DateTimeKind.Unspecified) - trOffset;
        var to = DateTime.SpecifyKind(toLocal, DateTimeKind.Unspecified) - trOffset;

        var sessions = await uow.LibrarySessions.GetByParticipantEntryRangeAsync(actorId, from, to, ct);
        var movements = new List<CitizenLibraryMovementDto>();
        var libraryCache = new Dictionary<Guid, Library?>();

        foreach (var s in sessions)
        {
            if (!libraryCache.TryGetValue(s.LibraryId, out var lib))
            {
                lib = await uow.Libraries.GetByIdAsync(s.LibraryId, ct);
                libraryCache[s.LibraryId] = lib;
            }
            var (floorName, _, seatLabel) = ResolveSeat(lib, s.Seat);
            var libName = lib?.Name ?? "—";

            movements.Add(new CitizenLibraryMovementDto(s.Id, "entry", libName, floorName, seatLabel, s.EntryTime, null));
            if (s.ExitTime is DateTime exit && exit >= from && exit < to)
                movements.Add(new CitizenLibraryMovementDto(s.Id, "exit", libName, floorName, seatLabel, exit, null));

            var breaks = await uow.LibraryBreaks.GetBySessionAsync(s.Id, ct);
            foreach (var b in breaks)
            {
                if (b.StartTime >= from && b.StartTime < to)
                    movements.Add(new CitizenLibraryMovementDto(b.Id, "break_start", libName, floorName, seatLabel, b.StartTime, b.Type));
                if (b.EndTime is DateTime bend && bend >= from && bend < to)
                    movements.Add(new CitizenLibraryMovementDto(b.Id, "break_end", libName, floorName, seatLabel, bend, b.Type));
            }
        }

        return movements.OrderBy(m => m.At).ToList();
    }

    public async Task<CitizenLibraryMyStatsDto> GetMyStatsAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var trOffset = TimeSpan.FromHours(3);
        var nowLocal = DateTime.UtcNow.Add(trOffset);
        var from = new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var to = DateTime.UtcNow.AddDays(1);

        var sessions = await uow.LibrarySessions.GetByParticipantEntryRangeAsync(actorId, from, to, ct);

        var todayStart = DateTime.SpecifyKind(nowLocal.Date, DateTimeKind.Unspecified) - trOffset;
        var weekStart = DateTime.SpecifyKind(nowLocal.Date.AddDays(-(int)((nowLocal.DayOfWeek == DayOfWeek.Sunday ? 7 : (int)nowLocal.DayOfWeek) - 1)), DateTimeKind.Unspecified) - trOffset;
        var monthStart = DateTime.SpecifyKind(new DateTime(nowLocal.Year, nowLocal.Month, 1), DateTimeKind.Unspecified) - trOffset;

        int totalVisits = sessions.Count;
        int totalExits = 0, totalMinutes = 0, monthMinutes = 0, weekMinutes = 0, todayMinutes = 0;
        int shortBreaks = 0, longBreaks = 0, noShowExits = 0;

        foreach (var s in sessions)
        {
            shortBreaks += s.ShortBreaksUsed;
            longBreaks += s.LongBreaksUsed;
            if (s.Status is LibrarySessionStatus.Completed or LibrarySessionStatus.StaffClosed) totalExits++;
            if (s.Status is LibrarySessionStatus.NoShow or LibrarySessionStatus.DeviceError) noShowExits++;

            var end = s.ExitTime ?? DateTime.UtcNow;
            var minutes = Math.Max(0, (int)(end - s.EntryTime).TotalMinutes);
            totalMinutes += minutes;
            if (s.EntryTime >= monthStart) monthMinutes += minutes;
            if (s.EntryTime >= weekStart) weekMinutes += minutes;
            if (s.EntryTime >= todayStart) todayMinutes += minutes;
        }

        var avg = totalVisits > 0 ? Math.Round((double)totalMinutes / totalVisits, 1) : 0.0;

        return new CitizenLibraryMyStatsDto(
            totalVisits, totalExits, totalMinutes, monthMinutes, weekMinutes, todayMinutes,
            shortBreaks, longBreaks, noShowExits, avg);
    }

    public async Task<CitizenLibraryStatsDto> GetStatsAsync(Guid libraryId, DateTime? date, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        if (library is null || !library.IsActive)
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");

        var trOffset = TimeSpan.FromHours(3);
        var localDay = (date ?? DateTime.UtcNow.Add(trOffset)).Date;
        var from = DateTime.SpecifyKind(localDay, DateTimeKind.Unspecified) - trOffset;
        var to = from.AddDays(1);

        var sessions = await uow.LibrarySessions.GetByLibraryEntryRangeAsync(libraryId, from, to, ct);
        var activeNow = await uow.LibrarySessions.CountInsideAsync(libraryId, ct);

        var capacity = library.Capacity;
        var occupancyRate = capacity > 0 ? Math.Round((double)activeNow / capacity * 100, 1) : 0.0;

        var todayEntries = sessions.Count;
        var completed = sessions.Where(s => s.ExitTime.HasValue).ToList();
        var todayExits = completed.Count;
        var avgStay = completed.Count > 0
            ? Math.Round(completed.Average(s => (s.ExitTime!.Value - s.EntryTime).TotalMinutes), 0)
            : 0.0;

        var hourly = Enumerable.Range(0, 24)
            .Select(h => new CitizenLibraryHourlyLoadDto(h, sessions.Count(s => s.EntryTime.Add(trOffset).Hour == h)))
            .ToList();
        int? peakHour = hourly.Any(h => h.Count > 0)
            ? hourly.OrderByDescending(h => h.Count).First().Hour
            : null;

        return new CitizenLibraryStatsDto(capacity, activeNow, occupancyRate, peakHour, todayEntries, todayExits, avgStay, hourly);
    }

    public async Task<CitizenSessionDto> CheckInAsync(Guid libraryId, double? latitude, double? longitude, CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");

        if (library.TriggersDevice)
            throw new ConflictException("Bu kıraathanede giriş turnike/kapıdan QR okutarak yapılır. QR kodunuzu okuyucuya gösterin.", "DEVICE_SCAN_REQUIRED");

        if (library.EntryControlMode == "manual")
            throw new ForbiddenException("Bu kıraathanede giriş görevli personel tarafından yapılır. Kendi başınıza giriş yapamazsınız.", "MANUAL_CHECKIN_REQUIRED");

        var checkInParticipant = await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Hesap bilgisi bulunamadı.", "PARTICIPANT_NOT_FOUND");
        var checkInResidencyViolation = Nexora.Domain.Common.EligibilityRules.CheckResidency(
            library.ResidencyMode, checkInParticipant, null, config["Residency:SultangaziDistrictCode"] ?? Nexora.Domain.Common.ResidencyPolicy.DefaultSultangaziDistrictCode);
        if (checkInResidencyViolation is not null)
            throw new ConflictException(checkInResidencyViolation.Message, checkInResidencyViolation.ErrorCode);

        var location = await uow.ServiceFacilities.GetByIdAsync(library.ServiceFacilityId, ct);
        Nexora.Application.Common.LocationAccessGuard.EnsureInside(
            library.GeofenceLatitude ?? location?.Latitude, library.GeofenceLongitude ?? location?.Longitude,
            library.GeofenceRadiusMeters, latitude, longitude);

        var method = library.EntryControlMode == "qr" ? "qr" : "manual";
        var req = new LibraryCheckInRequest(null, actorId.ToString(), null, null, null, null, method, null);
        var result = await libraryOps.CheckInAsync(libraryId, req, ct);
        if (!result.Entered)
            throw new ConflictException(result.Message, "CHECK_IN_NOT_COMPLETED");

        var session = await uow.LibrarySessions.GetActiveByParticipantAsync(actorId, ct)
            ?? throw new ConflictException("Giriş tamamlanamadı.", "CHECK_IN_NOT_COMPLETED");
        return await BuildSessionDtoAsync(session, library, ct);
    }

    public async Task<CitizenSessionDto> StartBreakAsync(string? type, CancellationToken ct)
    {
        var session = await ResolveActiveSessionAsync(ct);
        await libraryOps.StartBreakAsync(session.Id, new StartBreakRequest(type == "long" ? "long" : "short"), ct);
        var updated = await uow.LibrarySessions.GetByIdAsync(session.Id, ct) ?? session;
        var library = await uow.Libraries.GetByIdAsync(session.LibraryId, ct);
        return await BuildSessionDtoAsync(updated, library, ct);
    }

    public async Task<CitizenSessionDto> EndBreakAsync(CancellationToken ct)
    {
        var session = await ResolveActiveSessionAsync(ct);
        var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(session.Id, ct)
            ?? throw new ConflictException("Aktif bir molanız yok.", "NO_ACTIVE_BREAK");
        await libraryOps.EndBreakAsync(brk.Id, ct);
        var updated = await uow.LibrarySessions.GetByIdAsync(session.Id, ct) ?? session;
        var library = await uow.Libraries.GetByIdAsync(session.LibraryId, ct);
        return await BuildSessionDtoAsync(updated, library, ct);
    }

    public async Task ExitAsync(CancellationToken ct, double? latitude = null, double? longitude = null)
    {
        var session = await ResolveActiveSessionAsync(ct);
        var library = await uow.Libraries.GetByIdAsync(session.LibraryId, ct)
            ?? throw new NotFoundException("Kütüphane bulunamadı.", "LIBRARY_NOT_FOUND");
        var location = await uow.ServiceFacilities.GetByIdAsync(library.ServiceFacilityId, ct);
        Nexora.Application.Common.LocationAccessGuard.EnsureInside(library.GeofenceLatitude ?? location?.Latitude,
            library.GeofenceLongitude ?? location?.Longitude, library.GeofenceRadiusMeters, latitude, longitude);

        var cfg = await settings.GetAsync(session.LibraryId, ct);
        if (cfg.MinCheckoutAfterMinutes > 0)
        {
            var elapsedMinutes = (DateTime.UtcNow - session.EntryTime).TotalMinutes;
            if (elapsedMinutes < cfg.MinCheckoutAfterMinutes)
            {
                var remaining = (int)Math.Ceiling(cfg.MinCheckoutAfterMinutes - elapsedMinutes);
                throw new ConflictException(
                    $"Çıkış yapabilmeniz için en az {cfg.MinCheckoutAfterMinutes} dakika geçmesi gerekiyor. Lütfen {remaining} dakika sonra tekrar deneyin.",
                    "MIN_CHECKOUT_TIME_NOT_MET");
            }
        }
        await libraryOps.ExitAsync(session.Id, false, !library.TriggersDevice, ct);
    }

    private async Task<Domain.Entities.Libraries.LibrarySession> ResolveActiveSessionAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        return await uow.LibrarySessions.GetActiveByParticipantAsync(actorId, ct)
            ?? throw new ConflictException("Aktif bir kıraathane oturumunuz yok.", "NO_ACTIVE_SESSION");
    }

    public async Task<CitizenLibraryReservationDto> WalkInAsync(Guid libraryId, string? seat, CancellationToken ct)
    {
        var actorId = currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var result = await libraryOps.WalkInAsync(libraryId, new LibraryReservationRequest(null, actorId.ToString(), null, null, null, null, seat, null, null), ct);
        var res = await uow.LibraryReservations.GetByIdAsync(Guid.Parse(result.Id), ct);
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct);
        return ToReservation(res!, library);
    }

    public async Task<CitizenQueueJoinResultDto> JoinQueueAsync(Guid libraryId, CancellationToken ct)
    {
        var actorId = currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var pos = await libraryOps.JoinQueueAsync(libraryId, new LibraryReservationRequest(null, actorId.ToString(), null, null, null, null, null, null, null), ct);
        var entry = await uow.LibraryQueue.GetActiveByParticipantAsync(actorId, libraryId, ct);
        return new CitizenQueueJoinResultDto(entry?.Id.ToString() ?? "", pos, entry?.QueueNumber ?? "");
    }

    public async Task LeaveQueueAsync(Guid libraryId, CancellationToken ct)
    {
        var actorId = currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        await libraryOps.LeaveQueueAsync(libraryId, actorId, ct);
    }

    private static string Mask(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return "—";
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(" ", parts.Select(p => (p.Length <= 2 ? p : p[..2]).ToUpperInvariant() + "*****"));
    }

    public async Task<CitizenLibraryStatusDto> GetStatusAsync(Guid libraryId, CancellationToken ct)
    {
        var actorId = currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        var now = DateTime.UtcNow;

        var sessions = await uow.LibrarySessions.GetActiveByLibraryAsync(libraryId, ct);
        var onBreak = sessions.Where(x => LibrarySessionStatus.IsOnBreak(x.Status)).ToList();
        var inside = sessions.Where(x => !LibrarySessionStatus.IsOnBreak(x.Status)).ToList();
        var queue = await uow.LibraryQueue.GetActiveOrderedAsync(libraryId, ct);
        var waitingCount = queue.Count(x => x.Status == "waiting");

        var floors = new List<CitizenFloorCountDto>();
        try
        {
            var layout = string.IsNullOrWhiteSpace(library.LayoutJson)
                ? new LibraryLayoutDto(false, [])
                : JsonSerializer.Deserialize<LibraryLayoutDto>(library.LayoutJson, ReservationJsonOpts) ?? new LibraryLayoutDto(false, []);
            foreach (var f in layout.Floors.Where(x => x.Active))
            {
                var cnt = sessions.Count(se => !string.IsNullOrWhiteSpace(se.Seat) && se.Seat!.StartsWith(f.Id + ":", StringComparison.Ordinal));
                floors.Add(new CitizenFloorCountDto(f.Id, f.Name, f.Capacity, cnt));
            }
        }
        catch { }

        var insideList = inside
            .Select(x => new CitizenStatusPersonDto(x.ParticipantId == actorId ? x.MemberName : Mask(x.MemberName), x.ParticipantId == actorId, x.Seat, null))
            .ToList();

        var onBreakList = new List<CitizenStatusPersonDto>();
        foreach (var x in onBreak)
        {
            var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(x.Id, ct);
            int? rem = brk is not null ? Math.Max(0, (int)Math.Ceiling((brk.ExpectedReturnAt - now).TotalMinutes)) : null;
            onBreakList.Add(new CitizenStatusPersonDto(x.ParticipantId == actorId ? x.MemberName : Mask(x.MemberName), x.ParticipantId == actorId, x.Seat, rem));
        }

        var queueList = new List<CitizenStatusQueueDto>();
        var pos = 0;
        foreach (var q in queue)
        {
            if (q.Status == "waiting") pos++;
            var isMe = q.ParticipantId == actorId;
            int? callRem = q.Status == "called" && q.CountdownExpiresAt is DateTime ce ? Math.Max(0, (int)Math.Ceiling((ce - now).TotalMinutes)) : null;
            queueList.Add(new CitizenStatusQueueDto(isMe ? q.MemberName : Mask(q.MemberName), isMe, q.Status == "waiting" ? pos : 0, q.Status, callRem));
        }

        var mySession = sessions.FirstOrDefault(x => x.ParticipantId == actorId);
        var myQueue = queue.FirstOrDefault(x => x.ParticipantId == actorId);
        var myHold = await uow.LibraryReservations.GetActiveHoldByParticipantAsync(actorId, ct);
        var myHoldHere = myHold is not null && myHold.LibraryId == libraryId && myHold.HoldUntil > now ? myHold : null;

        CitizenMyLibraryStateDto my;
        if (mySession is not null)
        {
            int? breakRem = null;
            if (LibrarySessionStatus.IsOnBreak(mySession.Status))
            {
                var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(mySession.Id, ct);
                if (brk is not null) breakRem = Math.Max(0, (int)Math.Ceiling((brk.ExpectedReturnAt - now).TotalMinutes));
            }
            my = new CitizenMyLibraryStateDto(mySession.Status, null, null, breakRem, mySession.Seat, null);
        }
        else if (myQueue is not null)
        {
            if (myQueue.Status == "called")
            {
                int? callRem = myQueue.CountdownExpiresAt is DateTime ce ? Math.Max(0, (int)Math.Ceiling((ce - now).TotalMinutes)) : null;
                my = new CitizenMyLibraryStateDto("called", null, "called", callRem, null, null);
            }
            else
            {
                var myPos = queue.Where(x => x.Status == "waiting").ToList().FindIndex(x => x.Id == myQueue.Id) + 1;
                my = new CitizenMyLibraryStateDto("queued", myPos, "waiting", null, null, null);
            }
        }
        else if (myHoldHere is not null)
        {
            var holdRem = Math.Max(0, (int)Math.Ceiling((myHoldHere.HoldUntil - now).TotalMinutes));
            my = new CitizenMyLibraryStateDto("held", null, null, null, myHoldHere.Seat, holdRem);
        }
        else
        {
            my = new CitizenMyLibraryStateDto("none", null, null, null, null, null);
        }

        var insideCount = inside.Count;
        // Bulgu (2026-09-23, staj testi): "held" (yer ayırma/walk-in) kayıtları buraya
        // hiç dahil edilmiyordu — vatandaş koltuk ayırtınca kütüphane detayındaki
        // inside/free sayıları değişmiyordu. Süresi geçmiş (HoldUntil <= now) tutmalar
        // henüz LibraryMaintenanceJob tarafından "expired" yapılmamış olabilir, bu
        // yüzden burada da HoldUntil filtresi uygulanır (EnsureSeatAvailableAsync'teki
        // aynı desen).
        var activeHolds = await uow.LibraryReservations.GetActiveHoldsByLibraryAsync(libraryId, ct);
        var heldCount = activeHolds.Count(h => h.HoldUntil > now);
        var occupied = insideCount + onBreak.Count + heldCount;
        var free = Math.Max(0, library.Capacity - occupied);

        var reservationAllowed = true;
        if (library.ReservationEnabled)
        {
            var forfeitLimit = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ReservationForfeitLimit", 3);
            if (forfeitLimit > 0)
            {
                var windowDays = Microsoft.Extensions.Configuration.ConfigurationBinder.GetValue(config, "LibraryAccess:ReservationForfeitWindowDays", 30);
                DateTime? since = windowDays > 0 ? DateTime.UtcNow.AddDays(-windowDays) : null;
                var forfeited = await uow.LibraryReservations.CountForfeitedByParticipantAsync(actorId, libraryId, since, ct);
                reservationAllowed = forfeited < forfeitLimit;
            }
        }

        var s = await settings.GetAsync(libraryId, ct);
        var breakEnabled = await templateEngine.IsBreakSystemEnabledAsync(libraryId, ct);
        return new CitizenLibraryStatusDto(
            library.Id, library.Name, library.SeatingMode, library.ReservationEnabled, reservationAllowed, library.QueueEnabled,
            library.Capacity, insideCount, onBreak.Count, free, waitingCount,
            floors, insideList, onBreakList, queueList, my, breakEnabled);
    }

    private async Task<CitizenSessionDto> BuildSessionDtoAsync(Domain.Entities.Libraries.LibrarySession s, Library? library, CancellationToken ct)
    {
        var (floorName, sectionName, seatLabel) = ResolveSeat(library, s.Seat);
        DateTime? breakEndsAt = null;
        int? breakRemaining = null;
        string? breakType = null;
        if (LibrarySessionStatus.IsOnBreak(s.Status))
        {
            var brk = await uow.LibraryBreaks.GetActiveBySessionAsync(s.Id, ct);
            if (brk is not null)
            {
                breakEndsAt = brk.ExpectedReturnAt;
                breakRemaining = Math.Max(0, (int)Math.Ceiling((brk.ExpectedReturnAt - DateTime.UtcNow).TotalMinutes));
                breakType = brk.Type;
            }
        }

        var cfg = await settings.GetAsync(s.LibraryId, ct);
        int plannedMinutes = cfg.MaxSessionMinutes > 0
            ? cfg.MaxSessionMinutes
            : (cfg.MaxStudyHoursPerDay > 0 ? cfg.MaxStudyHoursPerDay * 60 : 0);
        int? maxStudyMinutes = plannedMinutes > 0 ? plannedMinutes : null;

        var now = DateTime.UtcNow;
        var pausedMinutes = await ComputePausedMinutesAsync(s.Id, now, ct);

        DateTime? estimatedExitAt = maxStudyMinutes.HasValue
            ? s.EntryTime.AddMinutes(maxStudyMinutes.Value + pausedMinutes)
            : null;
        int? remainingMinutes = estimatedExitAt.HasValue
            ? Math.Max(0, (int)Math.Ceiling((estimatedExitAt.Value - now).TotalMinutes))
            : null;

        return new CitizenSessionDto(
            s.Id,
            s.LibraryId,
            library?.Name ?? "—",
            library?.District,
            floorName,
            sectionName,
            seatLabel,
            s.Status,
            s.EntryTime,
            Math.Max(0, (int)(now - s.EntryTime).TotalMinutes),
            estimatedExitAt,
            remainingMinutes,
            maxStudyMinutes,
            breakEndsAt,
            breakRemaining,
            breakType,
            s.ShortBreaksUsed,
            s.LongBreaksUsed,
            cfg.MaxDailyBreaks > 0 ? Math.Max(0, cfg.MaxDailyBreaks - s.ShortBreaksUsed) : null,
            cfg.MaxDailyLongBreaks > 0 ? Math.Max(0, cfg.MaxDailyLongBreaks - s.LongBreaksUsed) : null,
            cfg.BreakDurationMinutes,
            cfg.LongBreakDurationMinutes,
            await templateEngine.IsBreakSystemEnabledAsync(s.LibraryId, ct));
    }

    private async Task<int> ComputePausedMinutesAsync(Guid sessionId, DateTime now, CancellationToken ct)
    {
        var breaks = await uow.LibraryBreaks.GetBySessionAsync(sessionId, ct);
        double total = 0;
        foreach (var b in breaks)
        {
            var end = b.EndTime ?? (b.Status == "active" ? now : b.EndTime);
            if (end is DateTime e && e > b.StartTime)
                total += (e - b.StartTime).TotalMinutes;
        }
        return (int)Math.Round(total);
    }

    public async Task<EmanetOverdueResult> GetMyOverdueBooksAsync(CancellationToken ct)
    {
        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(actorId, ct)
            ?? throw new NotFoundException("Hesap bilgisi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (string.IsNullOrWhiteSpace(participant.Tckn))
            return EmanetOverdueResult.Empty;

        return await emanet.GetOverdueAsync(participant.Tckn, ct);
    }

    private static string MapSeatStatus(string status)
        => status switch
        {
            "available" => "free",
            "occupied" => "occupied",
            "on_break" => "occupied",
            "reserved" => "held",
            "maintenance" => "blocked",
            _ => status.ToLowerInvariant(),
        };
}
