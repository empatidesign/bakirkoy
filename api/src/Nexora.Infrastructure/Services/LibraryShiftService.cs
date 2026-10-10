using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Domain.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class LibraryShiftService(IUnitOfWork uow, ICurrentUser current, IAuditService audit, IConfiguration config, IUserScopeService userScope) : ILibraryShiftService
{
    private async Task<IReadOnlyCollection<Guid>?> GetScopedLibraryIdsAsync(CancellationToken ct)
        => current.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "library", ct) : null;

    private async Task EnsureInScopeAsync(Guid libraryId, CancellationToken ct)
    {
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(libraryId))
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
    }

    private int AnomalousShiftHours => config.GetValue("LibraryMesai:AnomalousShiftHours", 14);
    private LibraryShiftDto MapShift(LibraryShift x) => LibraryStaffService.MapShift(x, AnomalousShiftHours);

    public async Task<List<LibraryShiftDto>> GetActiveAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        return (await uow.LibraryShifts.GetActiveByLibraryAsync(libraryId, ct)).Select(MapShift).ToList();
    }

    public async Task<List<LibraryShiftDto>> GetAllActiveAsync(CancellationToken ct)
    {
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        return (await uow.LibraryShifts.GetAllActiveAsync(ct))
            .Where(x => scopedRefIds is null || scopedRefIds.Contains(x.LibraryId))
            .OrderBy(x => x.LibraryName).ThenBy(x => x.StaffName)
            .Select(MapShift).ToList();
    }

    public async Task<PagedResult<LibraryShiftDto>> GetPagedAsync(Guid libraryId, LibraryShiftListParams p, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var paged = await uow.LibraryShifts.GetPagedByLibraryAsync(libraryId, p, ct);
        return new PagedResult<LibraryShiftDto>
        {
            Items = paged.Items.Select(MapShift).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<MesaiSummaryDto> GetSummaryAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var active = await uow.LibraryShifts.CountActiveByLibraryAsync(libraryId, ct);
        var today = await uow.LibraryShifts.CountTodayByLibraryAsync(libraryId, TurkeyTime.TodayStartUtc(), ct);
        var eligible = (await uow.LibraryStaff.GetEligibleAsync(libraryId, ct)).Count(x => x.IsActive);
        return new MesaiSummaryDto(active, today, eligible);
    }

    public async Task<MesaiOverviewSummaryDto> GetOverviewSummaryAsync(CancellationToken ct)
    {
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        var activeShifts = (await uow.LibraryShifts.GetAllActiveAsync(ct))
            .Where(x => scopedRefIds is null || scopedRefIds.Contains(x.LibraryId))
            .ToList();
        var today = await uow.LibraryShifts.CountTodayAsync(TurkeyTime.TodayStartUtc(), scopedRefIds, ct);
        var eligibleActive = (await uow.LibraryStaff.GetPagedAsync(new LibraryStaffListParams { Limit = "1", IsActive = true }, scopedRefIds, ct)).Total;
        return new MesaiOverviewSummaryDto(
            activeShifts.Count,
            today,
            eligibleActive,
            activeShifts.Select(x => x.LibraryId).Distinct().Count());
    }

    public async Task<LibraryShiftDto> StartAsync(Guid libraryId, StartShiftRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var staff = await uow.LibraryStaff.GetByIdAsync(req.StaffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        return await StartCoreAsync(libraryId, staff, "admin", req.Location, req.Notes, null, null, ct);
    }

    public async Task<MyMesaiDto> GetMineAsync(Guid libraryId, CancellationToken ct)
    {
        if (current.Id is not Guid uid) return new MyMesaiDto(null, null);
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct);
        if (staff is null || !staff.WorkingLibraryIds.Contains(libraryId)) return new MyMesaiDto(null, null);
        var active = await uow.LibraryShifts.GetActiveByStaffAsync(staff.Id, ct);
        var map = active is null ? new Dictionary<Guid, Domain.Entities.Libraries.LibraryShift>() : new Dictionary<Guid, Domain.Entities.Libraries.LibraryShift> { [staff.Id] = active };
        return new MyMesaiDto(LibraryStaffService.MapStaff(staff, map), active is null ? null : MapShift(active));
    }

    public async Task<LibraryShiftDto> StartMineAsync(Guid libraryId, SelfShiftRequest req, CancellationToken ct)
    {
        if (current.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");
        return await StartCoreAsync(libraryId, staff, "self", req.Location, req.Notes, req.Latitude, req.Longitude, ct);
    }

    public async Task EndMineAsync(Guid libraryId, CancellationToken ct)
    {
        if (current.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");
        var active = await uow.LibraryShifts.GetActiveByStaffAsync(staff.Id, ct)
            ?? throw new ConflictException("Aktif mesainiz bulunmuyor.", "NO_ACTIVE_SHIFT");
        active.End();
        uow.LibraryShifts.Update(active);
        await uow.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEntry { Action = AuditAction.CheckOut, EntityType = "LibraryShift", EntityId = active.Id, Module = "Library", Description = $"Mesai bitti (self): {active.StaffName}" }, ct);
    }

    public async Task<LibraryShiftDto?> TryAutoStartMineAsync(CancellationToken ct)
    {
        if (current.Id is not Guid uid) return null;
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct);
        if (staff is null || !staff.IsActive) return null;
        if (await uow.LibraryShifts.GetActiveByStaffAsync(staff.Id, ct) is not null) return null;
        if (string.IsNullOrWhiteSpace(current.IpAddress)) return null;
        if (staff.WorkingLibraryIds.Count == 0) return null;

        // Personelin çalışabileceği kıraathaneler arasından, bağlandığı IP'nin izinli ağ
        // listesinde tanımlı olduğu kıraathaneyi bulur. IP kısıtlaması tanımlı olmayan veya
        // eşleşmeyen kıraathaneler (5G/mobil ağ senaryosu) atlanır — bu durumda personel
        // manuel olarak kıraathanesini secip mesaisini kendisi başlatmalıdır.
        var candidates = (await uow.Libraries.GetActiveAsync(ct))
            .Where(l => staff.WorkingLibraryIds.Contains(l.Id))
            .Where(l => l.IpRestrictionEnabled && l.AllowedIps.Count > 0)
            .ToList();

        var matched = candidates.FirstOrDefault(l => Nexora.Domain.Common.IpMatcher.Matches(current.IpAddress, l.AllowedIps));
        if (matched is null) return null;

        return await StartCoreAsync(matched.Id, staff, "ip-auto", null, "IP eşleşmesiyle otomatik başlatıldı", null, null, ct);
    }

    private async Task<LibraryShiftDto> StartCoreAsync(Guid libraryId, LibraryStaff staff, string initiationType, string? location, string? notes, double? latitude, double? longitude, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        if (!staff.IsActive)
            throw new ConflictException("Pasif personel için mesai başlatılamaz.", "STAFF_INACTIVE");
        // Kullanıcı talimatı (2026-08-04): kapı QR'ı ile giriş/çıkışta WorkingLibraryIds
        // kısıtlaması UYGULANMAZ — library-mesai.door-access iznine sahip personel,
        // fiziksel olarak hangi kıraathanenin kapı cihazında QR'ını okutursa orada mesai
        // başlatabilir/bitirebilir (izin kontrolü zaten LibraryWebhookService.HandleStaffDoorAsync'te
        // yapıldı, cihazın kendisi de fiziksel konum kanıtı). Diğer başlatma türleri
        // (admin/self/ip-auto) WorkingLibraryIds kısıtlamasını korumaya devam eder.
        if (initiationType != "door-qr" && !staff.WorkingLibraryIds.Contains(libraryId))
            throw new ConflictException("Bu personelin bu kıraathanede çalışma yetkisi yok.", "STAFF_NOT_ELIGIBLE");

        // Kullanıcı isteği (2026-08-04): personel aynı anda yalnızca TEK bir yerde mesaide
        // olabilir — ama bir sonraki kıraathanede mesai başlatmak istediğinde, önceki
        // (farklı kıraathanedeki) aktif mesai elle bitirmeye zorlamak yerine otomatik
        // kapatılmalı. Aynı kıraathanede zaten aktif mesai varsa (mükerrer başlatma) hâlâ
        // reddediliyor — o durumda "otomatik kapat" mantıksız olur (zaten oradasınız).
        var existingActive = await uow.LibraryShifts.GetActiveByStaffAsync(staff.Id, ct);
        LibraryShift? autoClosedPreviousShift = null;
        if (existingActive is not null)
        {
            if (existingActive.LibraryId == libraryId)
                throw new ConflictException("Bu personelin zaten aktif bir mesaisi var.", "SHIFT_ALREADY_ACTIVE");

            // Task 9 fix (real, reportable finding): this previously called EndByIpTakeover() for
            // the "staff moved to a different library" auto-close, mislabeling every cross-library
            // shift switch as an IP-address takeover in the shift history even when the staff
            // member's own IP hadn't changed at all — EndedByIpTakeover is meant exclusively for
            // the actual same-IP-different-staff scenario handled separately below (line ~178).
            // Use the plain End() close for this "moved to a new library" case.
            existingActive.End();
            uow.LibraryShifts.Update(existingActive);
            autoClosedPreviousShift = existingActive;
        }

        EnforceGeofence(library, initiationType, latitude, longitude);
        EnforceIpRestriction(library, initiationType, current.IpAddress);
        EnforceWorkingHours(initiationType);

        LibraryShift? takenOverShift = null;
        if (initiationType is "self" or "ip-auto" && !string.IsNullOrWhiteSpace(current.IpAddress))
        {
            takenOverShift = await uow.LibraryShifts.GetActiveByIpAsync(current.IpAddress, staff.Id, ct);
            if (takenOverShift is not null)
            {
                takenOverShift.EndByIpTakeover();
                uow.LibraryShifts.Update(takenOverShift);
            }
        }

        var shift = LibraryShift.Start(staff.Id, staff.FullName, library.Id, library.Name, initiationType, current.Id, current.Name, location, notes, current.IpAddress);
        await uow.LibraryShifts.AddAsync(shift, ct);
        staff.SetLastWorkedLibrary(library.Id);
        uow.LibraryStaff.Update(staff);
        await uow.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEntry { Action = AuditAction.CheckIn, EntityType = "LibraryShift", EntityId = shift.Id, Module = "Library", Description = $"Mesai başladı ({initiationType}): {staff.FullName} ({library.Name})" }, ct);
        if (autoClosedPreviousShift is not null)
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.CheckOut,
                EntityType = "LibraryShift",
                EntityId = autoClosedPreviousShift.Id,
                Module = "Library",
                Description = $"Mesai, personel yeni bir kıraathanede mesai başlattığı için otomatik sonlandırıldı: {autoClosedPreviousShift.StaffName} ({autoClosedPreviousShift.LibraryName} → {library.Name})",
            }, ct);
        if (takenOverShift is not null)
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.CheckOut,
                EntityType = "LibraryShift",
                EntityId = takenOverShift.Id,
                Module = "Library",
                Description = $"Mesai terminal devralma ile otomatik sonlandı: {takenOverShift.StaffName} (aynı terminalden {staff.FullName} giriş yaptı, IP={current.IpAddress})",
            }, ct);
        return MapShift(shift);
    }

    // Kullanıcı isteği (2026-09-25): mesai 23:00'te kapanır. Kesimden sonra (gece) kendi başına
    // başlatılan mesai ertesi günün kesimine kadar açık kalıp sahte süre üretirdi; bu yüzden
    // kesim saati ile sabah açılış saati arasında personel kendi mesaisini başlatamaz.
    // Yönetici (admin) ve kapı QR (fiziksel geçiş) hariç.
    private void EnforceWorkingHours(string initiationType)
    {
        if (initiationType is "admin" or "door-qr") return;
        var cutoffHour = config.GetValue("FacilitySettings:DailyCutoffHour", 23);
        var cutoffMinute = config.GetValue("FacilitySettings:DailyCutoffMinute", 0);
        var openHour = config.GetValue("LibraryMesai:SelfStartOpenHour", 6);
        if (Nexora.Domain.Common.ShiftCutoff.IsInClosedWindow(TurkeyTime.Now(), cutoffHour, cutoffMinute, openHour))
            throw new ConflictException(
                $"Mesai {cutoffHour:00}:{cutoffMinute:00} ile {openHour:00}:00 arasında başlatılamaz (gün sonu kesimi).",
                "OUTSIDE_SHIFT_HOURS");
    }

    private static void EnforceGeofence(Library library, string initiationType, double? latitude, double? longitude)
    {
        // admin: yönetici manuel başlattı, ip-auto: IP eşleşmesi zaten fiziksel konumu kanıtlıyor,
        // door-qr: personel fiziksel kapı cihazından kendi kişisel QR'ını okuttu — cihazın
        // kendisi zaten o kıraathanede sabit kurulu olduğu için konum kanıtı zaten var.
        if (initiationType is "admin" or "ip-auto" or "door-qr") return;
        if (!library.GeofenceEnabled) return;
        if (!library.GeofenceLatitude.HasValue || !library.GeofenceLongitude.HasValue) return;

        if (!latitude.HasValue || !longitude.HasValue)
            throw new ConflictException("Bu kıraathanede mesai başlatmak için konum bilgisi zorunludur.", "LOCATION_REQUIRED");

        var distanceMeters = Nexora.Domain.Common.GeoDistance.HaversineMeters(
            library.GeofenceLatitude.Value, library.GeofenceLongitude.Value, latitude.Value, longitude.Value);

        if (distanceMeters > library.GeofenceRadiusMeters)
            throw new ConflictException(
                $"Kütüphane konumundan çok uzaktasınız ({(int)distanceMeters}m, izinli yarıçap {library.GeofenceRadiusMeters}m). Mesai binada başlatılmalıdır.",
                "OUTSIDE_GEOFENCE");
    }

    private static void EnforceIpRestriction(Library library, string initiationType, string? clientIp)
    {
        // door-qr: cihazın kendisi zaten kıraathanenin ağına/binasına bağlı sabit bir donanım,
        // ayrıca IP kısıtlaması uygulamak gereksiz — fiziksel kapıdan geçiş zaten yeterli kanıt.
        if (initiationType is "admin" or "door-qr") return;
        if (!library.IpRestrictionEnabled) return;
        if (library.AllowedIps.Count == 0) return;

        if (!Nexora.Domain.Common.IpMatcher.Matches(clientIp, library.AllowedIps))
            throw new ConflictException(
                "Mesai yalnızca kıraathanenin kendi ağından başlatılabilir. Lütfen kurum internetine bağlı olduğunuzdan emin olun.",
                "OUTSIDE_ALLOWED_NETWORK");
    }

    public async Task EndAsync(Guid shiftId, CancellationToken ct)
    {
        var shift = await uow.LibraryShifts.GetByIdAsync(shiftId, ct)
            ?? throw new NotFoundException("Mesai kaydı bulunamadı.", "SHIFT_NOT_FOUND");
        await EnsureInScopeAsync(shift.LibraryId, ct);
        if (shift.Status != "active")
            throw new ConflictException("Bu mesai zaten bitirilmiş.", "SHIFT_NOT_ACTIVE");

        shift.End();
        uow.LibraryShifts.Update(shift);
        await uow.SaveChangesAsync(ct);
        await audit.LogAsync(new AuditEntry { Action = AuditAction.CheckOut, EntityType = "LibraryShift", EntityId = shift.Id, Module = "Library", Description = $"Mesai bitti: {shift.StaffName} ({shift.WorkedMinutes} dk)" }, ct);
    }

    public async Task<LibraryShiftDto> EditAsync(Guid shiftId, EditShiftRequest req, CancellationToken ct)
    {
        var shift = await uow.LibraryShifts.GetByIdAsync(shiftId, ct)
            ?? throw new NotFoundException("Mesai kaydı bulunamadı.", "SHIFT_NOT_FOUND");
        await EnsureInScopeAsync(shift.LibraryId, ct);
        return await ApplyEditAsync(shift, req, isSelfEdit: false, ct);
    }

    public async Task<LibraryShiftDto> EditMineAsync(Guid shiftId, EditShiftRequest req, CancellationToken ct)
    {
        if (current.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");
        if (!staff.CanEditOwnShifts)
            throw new ForbiddenException("Kendi mesai kayıtlarınızı düzenleme izniniz yok. Yöneticinizden izin isteyin.", "SELF_EDIT_NOT_ALLOWED");

        var shift = await uow.LibraryShifts.GetByIdAsync(shiftId, ct)
            ?? throw new NotFoundException("Mesai kaydı bulunamadı.", "SHIFT_NOT_FOUND");
        if (shift.StaffId != staff.Id)
            throw new ForbiddenException("Yalnızca kendi mesai kayıtlarınızı düzenleyebilirsiniz.", "NOT_YOUR_SHIFT");

        return await ApplyEditAsync(shift, req, isSelfEdit: true, ct);
    }

    private async Task<LibraryShiftDto> ApplyEditAsync(LibraryShift shift, EditShiftRequest req, bool isSelfEdit, CancellationToken ct)
    {
        if (shift.Status == "active")
            throw new ConflictException("Devam eden bir mesai düzenlenemez. Önce mesaiyi bitirin.", "SHIFT_STILL_ACTIVE");
        if (req.EndTime <= req.StartTime)
            throw new ConflictException("Çıkış saati giriş saatinden sonra olmalıdır.", "INVALID_TIME_RANGE");
        if (req.EndTime > DateTime.UtcNow.AddMinutes(5))
            throw new ConflictException("Çıkış saati gelecekte olamaz.", "END_TIME_IN_FUTURE");

        var maxShiftHours = config.GetValue("LibraryMesai:MaxShiftHours", 24);
        if ((req.EndTime - req.StartTime).TotalHours > maxShiftHours)
            throw new ConflictException($"Bir mesai kaydı {maxShiftHours} saatten uzun olamaz.", "SHIFT_TOO_LONG");

        var backdateDays = config.GetValue("LibraryMesai:MaxSelfEditBackdateDays", 7);
        if (isSelfEdit)
        {
            var earliest = DateTime.UtcNow.AddDays(-backdateDays);
            if (req.StartTime < earliest)
                throw new ConflictException($"Kendi mesai kaydınızı en fazla {backdateDays} gün geriye düzenleyebilirsiniz. Daha eski kayıtlar için yöneticinize başvurun.", "EDIT_WINDOW_PASSED");
            if (string.IsNullOrWhiteSpace(req.Reason))
                throw new ConflictException("Mesai düzenlemesi için gerekçe girmelisiniz.", "REASON_REQUIRED");
        }

        var oldStart = shift.StartTime;
        var oldEnd = shift.EndTime;
        shift.Edit(req.StartTime, req.EndTime, current.Id, current.Name, req.Reason);
        uow.LibraryShifts.Update(shift);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "LibraryShift",
            EntityId = shift.Id,
            Module = "Library",
            Description = $"Mesai saati düzenlendi ({(isSelfEdit ? "kendi mesaisi" : "yönetici")}): {shift.StaffName} — " +
                $"{oldStart:dd.MM HH:mm}-{(oldEnd.HasValue ? oldEnd.Value.ToString("HH:mm") : "?")} → {req.StartTime:dd.MM HH:mm}-{req.EndTime:HH:mm}" +
                (string.IsNullOrWhiteSpace(req.Reason) ? "" : $" (sebep: {req.Reason})"),
            OldValues = System.Text.Json.JsonSerializer.Serialize(new { start = oldStart, end = oldEnd }),
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { start = req.StartTime, end = req.EndTime }),
        }, ct);

        return MapShift(shift);
    }

    public async Task<PagedResult<LibraryShiftDto>> GetMyShiftsAsync(LibraryShiftListParams p, CancellationToken ct)
    {
        if (current.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");

        var scoped = p with { StaffId = staff.Id.ToString() };
        var paged = await uow.LibraryShifts.GetPagedOverviewAsync(scoped, null, ct);
        return new PagedResult<LibraryShiftDto>
        {
            Items = paged.Items.Select(MapShift).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<MyMesaiMonthSummaryDto> GetMyMonthSummaryAsync(int? year, int? month, CancellationToken ct)
    {
        return await GetMyMonthSummaryCoreAsync(year, month, ct);
    }

    // Mesaiyi Türkiye günlerine böler (gece yarısını aşan mesai iki güne dağıtılır).
    internal static IEnumerable<(DateOnly Day, int Minutes)> SplitByTurkeyDay(LibraryShift s, DateTime nowUtc)
    {
        var endUtc = s.EndTime ?? (s.Status == "active" ? nowUtc : s.StartTime.AddMinutes(s.WorkedMinutes ?? 0));
        // Düzenlenmiş/içe aktarılmış kayıtta süre ile uçlar tutmayabilir: toplam, kaydın kendi süresine eşitlenir.
        var total = s.EffectiveWorkedMinutes(nowUtc);
        var start = TurkeyTime.ToTurkey(s.StartTime);
        var end = TurkeyTime.ToTurkey(endUtc);
        if (end <= start || total <= 0) { yield return (DateOnly.FromDateTime(start), Math.Max(0, total)); yield break; }
        var span = (end - start).TotalMinutes;
        var cursor = start; var given = 0;
        while (cursor < end)
        {
            var dayEnd = cursor.Date.AddDays(1);
            var segEnd = dayEnd < end ? dayEnd : end;
            var mins = segEnd == end ? total - given : (int)Math.Round((segEnd - cursor).TotalMinutes / span * total);
            given += mins;
            yield return (DateOnly.FromDateTime(cursor), mins);
            cursor = segEnd;
        }
    }

    public async Task<MesaiMonthlyReportDto> GetMonthlyReportAsync(MesaiMonthlyReportParams p, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var y = p.Year ?? today.Year;
        var m = p.Month is >= 1 and <= 12 ? p.Month.Value : today.Month;
        var monthStartLocal = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var days = DateTime.DaysInMonth(y, m);
        var startUtc = TurkeyTime.ToUtc(monthStartLocal);
        var endUtc = TurkeyTime.ToUtc(monthStartLocal.AddMonths(1));

        var libraryId = Guid.TryParse(p.LibraryId, out var lid) ? (Guid?)lid : null;
        if (libraryId.HasValue) await EnsureInScopeAsync(libraryId.Value, ct);
        var scoped = await GetScopedLibraryIdsAsync(ct);
        // Önceki ayın son günü başlayıp bu aya taşan mesai de dahil edilir (1 gün geriden oku).
        var shifts = await uow.LibraryShifts.GetInRangeAsync(startUtc.AddDays(-1), endUtc, libraryId, scoped, ct);
        if (Guid.TryParse(p.StaffId, out var sid)) shifts = shifts.Where(s => s.StaffId == sid).ToList();

        var nowUtc = DateTime.UtcNow;
        var first = DateOnly.FromDateTime(monthStartLocal);
        var last = first.AddDays(days - 1);
        var pieces = shifts
            .SelectMany(s => SplitByTurkeyDay(s, nowUtc).Select(x => (Shift: s, x.Day, x.Minutes)))
            .Where(x => x.Day >= first && x.Day <= last)
            .ToList();
        var inMonth = pieces.Select(x => x.Shift).Distinct().ToList();

        var staffIds = inMonth.Select(s => s.StaffId).Distinct().ToList();
        var staffRoles = new Dictionary<Guid, string?>();
        foreach (var id in staffIds)
            staffRoles[id] = (await uow.LibraryStaff.GetByIdAsync(id, ct))?.RoleName;

        string? Fmt(DateTime? utc) => utc is null ? null : TurkeyTime.ToTurkey(utc.Value).ToString("dd.MM.yyyy HH:mm");

        var staffRows = pieces.GroupBy(x => x.Shift.StaffId).Select(g =>
        {
            var dayMinutes = new int[days];
            foreach (var x in g) dayMinutes[x.Day.Day - 1] += x.Minutes;
            var myShifts = g.Select(x => x.Shift).Distinct().ToList();
            var worked = dayMinutes.Count(d => d > 0);
            var total = dayMinutes.Sum();
            return new MesaiMonthlyStaffRowDto(
                g.Key.ToString(),
                myShifts[0].StaffName,
                staffRoles.GetValueOrDefault(g.Key),
                total,
                myShifts.Count,
                worked,
                worked == 0 ? 0 : total / worked,
                dayMinutes.Max(),
                myShifts.Count(s => s.AutoClosedAtCutoff),
                myShifts.Count(s => s.WasEdited),
                Fmt(myShifts.Min(s => s.StartTime)),
                Fmt(myShifts.Where(s => s.EndTime.HasValue).Select(s => s.EndTime).Max()),
                dayMinutes.ToList(),
                g.GroupBy(x => new { x.Shift.LibraryId, x.Shift.LibraryName })
                    .Select(l => new MyMesaiLibraryTotalDto(l.Key.LibraryId.ToString(), l.Key.LibraryName, l.Sum(x => x.Minutes), l.Select(x => x.Shift.Id).Distinct().Count()))
                    .OrderByDescending(l => l.TotalMinutes).ToList());
        }).OrderByDescending(r => r.TotalMinutes).ToList();

        var libRows = pieces.GroupBy(x => new { x.Shift.LibraryId, x.Shift.LibraryName }).Select(g => new MesaiMonthlyLibraryRowDto(
            g.Key.LibraryId.ToString(), g.Key.LibraryName, g.Sum(x => x.Minutes),
            g.Select(x => x.Shift.Id).Distinct().Count(), g.Select(x => x.Shift.StaffId).Distinct().Count(),
            g.Select(x => x.Day).Distinct().Count())).OrderByDescending(r => r.TotalMinutes).ToList();

        var daily = Enumerable.Range(0, days).Select(i =>
        {
            var d = first.AddDays(i);
            var ps = pieces.Where(x => x.Day == d).ToList();
            return new DailyMesaiTotalDto(d, ps.Sum(x => x.Minutes), ps.Select(x => x.Shift.Id).Distinct().Count());
        }).ToList();

        return new MesaiMonthlyReportDto(y, m, days, pieces.Sum(x => x.Minutes), inMonth.Count, staffRows.Count, libRows.Count,
            inMonth.Count(s => s.AutoClosedAtCutoff), inMonth.Count(s => s.WasEdited), staffRows, libRows, daily);
    }

    public async Task<byte[]> ExportMonthlyReportAsync(MesaiMonthlyReportParams p, CancellationToken ct)
    {
        var r = await GetMonthlyReportAsync(p, ct);
        static string H(int min) => $"{min / 60}:{min % 60:00}";
        using var wb = new ClosedXML.Excel.XLWorkbook();

        var ws = wb.AddWorksheet("Personel Özeti");
        string[] head = ["Personel", "Görev", "Toplam (sa:dk)", "Toplam dk", "Mesai sayısı", "Çalışılan gün", "Günlük ort. (sa:dk)", "En uzun gün (sa:dk)", "Otomatik kapanan", "Düzenlenen", "İlk giriş", "Son çıkış", "Kütüphaneler"];
        for (var i = 0; i < head.Length; i++) ws.Cell(1, i + 1).Value = head[i];
        var row = 2;
        foreach (var s in r.Staff)
        {
            ws.Cell(row, 1).Value = s.StaffName; ws.Cell(row, 2).Value = s.RoleName ?? "";
            ws.Cell(row, 3).Value = H(s.TotalMinutes); ws.Cell(row, 4).Value = s.TotalMinutes;
            ws.Cell(row, 5).Value = s.ShiftCount; ws.Cell(row, 6).Value = s.WorkedDays;
            ws.Cell(row, 7).Value = H(s.AvgDailyMinutes); ws.Cell(row, 8).Value = H(s.LongestDayMinutes);
            ws.Cell(row, 9).Value = s.AutoClosedCount; ws.Cell(row, 10).Value = s.EditedCount;
            ws.Cell(row, 11).Value = s.FirstEntry ?? ""; ws.Cell(row, 12).Value = s.LastExit ?? "";
            ws.Cell(row, 13).Value = string.Join("; ", s.ByLibrary.Select(b => $"{b.LibraryName}: {H(b.TotalMinutes)}"));
            row++;
        }

        var grid = wb.AddWorksheet("Gün Gün (saat)");
        grid.Cell(1, 1).Value = "Personel";
        for (var d = 1; d <= r.DaysInMonth; d++) grid.Cell(1, d + 1).Value = $"{d:00} {new DateTime(r.Year, r.Month, d):ddd}";
        grid.Cell(1, r.DaysInMonth + 2).Value = "Toplam";
        row = 2;
        foreach (var s in r.Staff)
        {
            grid.Cell(row, 1).Value = s.StaffName;
            for (var d = 0; d < r.DaysInMonth; d++) if (s.DayMinutes[d] > 0) grid.Cell(row, d + 2).Value = H(s.DayMinutes[d]);
            grid.Cell(row, r.DaysInMonth + 2).Value = H(s.TotalMinutes);
            row++;
        }

        var lib = wb.AddWorksheet("Kütüphane Bazında");
        string[] lh = ["Kütüphane", "Toplam (sa:dk)", "Mesai sayısı", "Personel sayısı", "Açık gün"];
        for (var i = 0; i < lh.Length; i++) lib.Cell(1, i + 1).Value = lh[i];
        row = 2;
        foreach (var l in r.Libraries)
        {
            lib.Cell(row, 1).Value = l.LibraryName; lib.Cell(row, 2).Value = H(l.TotalMinutes);
            lib.Cell(row, 3).Value = l.ShiftCount; lib.Cell(row, 4).Value = l.StaffCount; lib.Cell(row, 5).Value = l.WorkedDays;
            row++;
        }

        // Tüm giriş-çıkış kayıtları (ham döküm)
        var detail = wb.AddWorksheet("Tüm Giriş-Çıkışlar");
        string[] dh = ["Personel", "Kütüphane", "Tarih", "Giriş", "Çıkış", "Süre (sa:dk)", "Başlatma", "Durum", "Not"];
        for (var i = 0; i < dh.Length; i++) detail.Cell(1, i + 1).Value = dh[i];
        var ms = new DateTime(r.Year, r.Month, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var libraryId = Guid.TryParse(p.LibraryId, out var lid2) ? (Guid?)lid2 : null;
        var all = await uow.LibraryShifts.GetInRangeAsync(TurkeyTime.ToUtc(ms), TurkeyTime.ToUtc(ms.AddMonths(1)), libraryId, await GetScopedLibraryIdsAsync(ct), ct);
        if (Guid.TryParse(p.StaffId, out var sid2)) all = all.Where(s => s.StaffId == sid2).ToList();
        row = 2;
        var nowUtc = DateTime.UtcNow;
        foreach (var s in all.OrderBy(s => s.StaffName).ThenBy(s => s.StartTime))
        {
            var st = TurkeyTime.ToTurkey(s.StartTime);
            detail.Cell(row, 1).Value = s.StaffName; detail.Cell(row, 2).Value = s.LibraryName;
            detail.Cell(row, 3).Value = st.ToString("dd.MM.yyyy ddd"); detail.Cell(row, 4).Value = st.ToString("HH:mm");
            detail.Cell(row, 5).Value = s.EndTime is null ? "devam ediyor" : TurkeyTime.ToTurkey(s.EndTime.Value).ToString("HH:mm");
            detail.Cell(row, 6).Value = H(s.EffectiveWorkedMinutes(nowUtc));
            detail.Cell(row, 7).Value = s.InitiationType switch { "self" => "Kendisi", "door-qr" => "Kapı QR", "ip-auto" => "Ağ (otomatik)", _ => "Yönetici" };
            detail.Cell(row, 8).Value = s.AutoClosedAtCutoff ? "23:00 otomatik kapandı" : s.WasEdited ? "Düzenlendi" : s.Status == "active" ? "Devam ediyor" : "Normal";
            detail.Cell(row, 9).Value = s.EditReason ?? s.Notes ?? "";
            row++;
        }

        foreach (var sheet in wb.Worksheets)
        {
            sheet.Row(1).Style.Font.Bold = true;
            sheet.Row(1).Style.Fill.BackgroundColor = ClosedXML.Excel.XLColor.FromHtml("#1F3A8A");
            sheet.Row(1).Style.Font.FontColor = ClosedXML.Excel.XLColor.White;
            sheet.SheetView.FreezeRows(1);
            sheet.Columns().AdjustToContents(1, 200);
        }
        using var msOut = new MemoryStream();
        wb.SaveAs(msOut);
        return msOut.ToArray();
    }

    private async Task<MyMesaiMonthSummaryDto> GetMyMonthSummaryCoreAsync(int? year, int? month, CancellationToken ct)
    {
        if (current.Id is not Guid uid)
            throw new ForbiddenException("Oturum bulunamadı.", "NO_SESSION");
        var staff = await uow.LibraryStaff.GetByAdminUserAsync(uid, ct)
            ?? throw new ConflictException("Personel kaydınız bulunmuyor.", "NOT_STAFF");

        var today = TurkeyTime.TodayDate();
        var y = year ?? today.Year;
        var m = month is >= 1 and <= 12 ? month.Value : today.Month;
        var monthStartLocal = new DateTime(y, m, 1, 0, 0, 0, DateTimeKind.Unspecified);
        var startUtc = TurkeyTime.ToUtc(monthStartLocal);
        var endUtc = TurkeyTime.ToUtc(monthStartLocal.AddMonths(1));

        var nowUtc = DateTime.UtcNow;
        var shifts = (await uow.LibraryShifts.GetForStaffInRangeAsync(staff.Id, startUtc, endUtc, ct))
            .OrderByDescending(s => s.StartTime)
            .ToList();

        // Gün, Türkiye saatine göre (UTC tarihi 00:00–03:00 arası mesaiyi bir önceki güne yazardı).
        var daily = shifts
            .GroupBy(s => DateOnly.FromDateTime(TurkeyTime.ToTurkey(s.StartTime)))
            .Select(g => new DailyMesaiTotalDto(g.Key, g.Sum(s => s.EffectiveWorkedMinutes(nowUtc)), g.Count()))
            .OrderBy(d => d.Date)
            .ToList();
        var byLibrary = shifts
            .GroupBy(s => new { s.LibraryId, s.LibraryName })
            .Select(g => new MyMesaiLibraryTotalDto(g.Key.LibraryId.ToString(), g.Key.LibraryName, g.Sum(s => s.EffectiveWorkedMinutes(nowUtc)), g.Count()))
            .OrderByDescending(x => x.TotalMinutes)
            .ToList();

        return new MyMesaiMonthSummaryDto(
            y, m,
            shifts.Sum(s => s.EffectiveWorkedMinutes(nowUtc)),
            shifts.Count,
            daily.Count,
            shifts.Count(s => s.AutoClosedAtCutoff),
            byLibrary,
            daily,
            shifts.Select(MapShift).ToList());
    }

    public async Task<PagedResult<LibraryShiftDto>> GetOverviewPagedAsync(LibraryShiftListParams p, CancellationToken ct)
    {
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        var paged = await uow.LibraryShifts.GetPagedOverviewAsync(p, scopedRefIds, ct);
        return new PagedResult<LibraryShiftDto>
        {
            Items = paged.Items.Select(MapShift).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<StaffMesaiPeriodTotalsDto> GetStaffPeriodTotalsAsync(Guid staffId, DateTime startUtc, DateTime endUtc, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        var shifts = (await uow.LibraryShifts.GetForStaffInRangeAsync(staffId, startUtc, endUtc, ct))
            .Where(s => scopedRefIds is null || scopedRefIds.Contains(s.LibraryId))
            .ToList();

        var nowUtc = DateTime.UtcNow;

        var daily = shifts
            .GroupBy(s => DateOnly.FromDateTime(s.StartTime))
            .Select(g => new DailyMesaiTotalDto(g.Key, g.Sum(s => s.EffectiveWorkedMinutes(nowUtc)), g.Count()))
            .OrderBy(d => d.Date)
            .ToList();

        var maxWeeklyHours = config.GetValue("LibraryMesai:MaxWeeklyHours", 60);
        var hasWeekOverLimit = daily
            .GroupBy(d => (d.Date.Year, System.Globalization.ISOWeek.GetWeekOfYear(d.Date.ToDateTime(TimeOnly.MinValue))))
            .Any(g => g.Sum(d => d.TotalMinutes) > maxWeeklyHours * 60);

        return new StaffMesaiPeriodTotalsDto(
            staffId.ToString(),
            staff.FullName,
            shifts.Sum(s => s.EffectiveWorkedMinutes(nowUtc)),
            shifts.Count,
            shifts.Count > 0 ? shifts.Min(s => s.StartTime) : null,
            shifts.Count > 0 ? shifts.Where(s => s.EndTime.HasValue).Select(s => s.EndTime!.Value).DefaultIfEmpty().Max() : null,
            daily,
            hasWeekOverLimit,
            maxWeeklyHours);
    }

    public async Task<List<TopMesaiStaffDto>> GetLeaderboardAsync(MesaiLeaderboardParams p, CancellationToken ct)
    {
        var todayTr = TurkeyTime.TodayDate();
        var year = p.Year ?? todayTr.Year;
        var month = p.Month ?? todayTr.Month;
        var start = TurkeyTime.ToUtc(new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Unspecified));
        var end = TurkeyTime.ToUtc(new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Unspecified).AddMonths(1));

        var libraryId = Guid.TryParse(p.LibraryId, out var lid) ? (Guid?)lid : null;
        if (libraryId.HasValue) await EnsureInScopeAsync(libraryId.Value, ct);
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        var shifts = await uow.LibraryShifts.GetInRangeAsync(start, end, libraryId, scopedRefIds, ct);

        var nowUtc = DateTime.UtcNow;

        var limit = p.Limit is null or <= 0 ? 20 : p.Limit.Value;
        return shifts
            .GroupBy(s => s.StaffId)
            .Select(g => new
            {
                StaffId = g.Key,
                StaffName = g.First().StaffName,
                TotalMinutes = g.Sum(s => s.EffectiveWorkedMinutes(nowUtc)),
                ShiftCount = g.Count(),
                DistinctLibraryCount = g.Select(s => s.LibraryId).Distinct().Count(),
            })
            .OrderByDescending(x => x.TotalMinutes)
            .Take(limit)
            .Select(x => new TopMesaiStaffDto(x.StaffId.ToString(), x.StaffName, null, x.TotalMinutes, x.ShiftCount, x.DistinctLibraryCount))
            .ToList();
    }

    public async Task<MesaiReportSummaryDto> GetReportSummaryAsync(LibraryShiftListParams p, CancellationToken ct)
    {
        var scopedRefIds = await GetScopedLibraryIdsAsync(ct);
        var all = new List<LibraryShift>();
        var page = 1;
        const int pageSize = 500;
        while (true)
        {
            var batch = await uow.LibraryShifts.GetPagedOverviewAsync(p with { Page = page.ToString(), Limit = pageSize.ToString() }, scopedRefIds, ct);
            all.AddRange(batch.Items);
            if (all.Count >= batch.Total || batch.Items.Count == 0) break;
            page++;
        }

        var nowUtc = DateTime.UtcNow;

        var shortLivedThresholdMinutes = config.GetValue("LibraryMesai:ShortLivedShiftMinutes", 5);
        var shortLivedCount = all.Count(s => s.Status == "ended" && s.WorkedMinutes.HasValue && s.WorkedMinutes.Value < shortLivedThresholdMinutes);

        return new MesaiReportSummaryDto(
            all.Count,
            all.Sum(s => s.EffectiveWorkedMinutes(nowUtc)),
            all.Count(s => s.AutoClosedAtCutoff),
            all.Count(s => s.WasEdited),
            all.Select(s => s.StaffId).Distinct().Count(),
            shortLivedCount,
            all.Count(s => s.EndedByIpTakeover));
    }

    public async Task<DoorQrToggleResultDto> ToggleDoorQrAsync(Guid staffId, Guid libraryId, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        var existingActive = await uow.LibraryShifts.GetActiveByStaffAsync(staffId, ct);

        if (existingActive is not null && existingActive.LibraryId == libraryId)
        {
            existingActive.End();
            uow.LibraryShifts.Update(existingActive);
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.CheckOut,
                EntityType = "LibraryShift",
                EntityId = existingActive.Id,
                Module = "Library",
                Description = $"Mesai bitti (kapı QR): {staff.FullName} ({existingActive.LibraryName})",
            }, ct);
            return new DoorQrToggleResultDto(false, staff.FullName, "Güle Güle", existingActive.LibraryName);
        }

        var shift = await StartCoreAsync(libraryId, staff, "door-qr", null, null, null, null, ct);
        return new DoorQrToggleResultDto(true, staff.FullName, "Hoş Geldiniz", shift.LibraryName);
    }
}
