using System.Text.Json;
using Nexora.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class LibraryManagementService(
    IUnitOfWork uow,
    IAuditService audit,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    IScopedStaffService scopedStaff,
    ILibrarySettingsService settingsService,
    IServiceProvider serviceProvider,
    IOptionsMonitor<MinioSettings> minioOptions) : ILibraryService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task<PagedResult<LibraryDto>> GetPagedAsync(LibraryListParams p, CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "library", ct)
            : null;
        var paged = await uow.Libraries.GetPagedAsync(p, scopedRefIds, ct);
        var libIds = paged.Items.Select(l => l.Id).ToList();
        var inside = await uow.LibrarySessions.CountInsideByLibrariesAsync(libIds, ct);
        var onBreak = await uow.LibrarySessions.CountOnBreakByLibrariesAsync(libIds, ct);
        var waiting = await uow.LibraryQueue.CountWaitingByLibrariesAsync(libIds, ct);
        var settingsByLib = await settingsService.GetForLibrariesAsync(libIds, ct);
        var items = new List<LibraryDto>(paged.Items.Count);
        foreach (var l in paged.Items)
        {
            var libSettings = settingsByLib[l.Id];
            items.Add(MapDto(l, inside.GetValueOrDefault(l.Id), onBreak.GetValueOrDefault(l.Id), waiting.GetValueOrDefault(l.Id), libSettings.BreakSystemEnabled, libSettings.AutoCheckOutAfterMinutes));
        }
        return new PagedResult<LibraryDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<IReadOnlyList<LibraryOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var list = await uow.Libraries.GetActiveAsync(ct);
        return list.Select(l => new LibraryOptionDto(l.Id.ToString(), l.Name, l.District, l.City)).ToList();
    }

    public async Task<LibraryOverviewSummaryDto> GetOverviewSummaryAsync(CancellationToken ct)
    {
        var b = await uow.Libraries.GetOverviewSummaryAsync(ct);
        var occupancy = await uow.LibrarySessions.CountAllInsideAsync(ct);
        var onBreak = await uow.LibrarySessions.CountAllOnBreakAsync(ct);
        var waiting = await uow.LibraryQueue.CountAllWaitingAsync(ct);
        var rate = b.TotalCapacity > 0 ? (int)Math.Round((double)occupancy / b.TotalCapacity * 100) : 0;
        return b with { TotalOccupancy = occupancy, TotalOnBreak = onBreak, TotalWaiting = waiting, OccupancyRate = rate };
    }

    // Yetki alani (scope) kisitli bir kullanicinin, kendi liste ekraninda gormedigi
    // bir kutuphanenin ID'sini biliyorsa bile erismesini engeller (IDOR onlemi).
    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(id))
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
    }

    public async Task<LibraryDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var lib = await uow.Libraries.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        var libSettings = await settingsService.GetAsync(lib.Id, ct);
        return MapDto(lib, breakSystemEnabled: libSettings.BreakSystemEnabled, autoCheckOutAfterMinutes: libSettings.AutoCheckOutAfterMinutes);
    }

    public async Task<LibraryDetailSummaryDto> GetDetailSummaryAsync(Guid id, CancellationToken ct)
    {
        var lib = await uow.Libraries.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        var inside = await uow.LibrarySessions.CountInsideAsync(id, ct);
        var onBreak = await uow.LibrarySessions.CountOnBreakAsync(id, ct);
        var waiting = await uow.LibraryQueue.CountWaitingAsync(id, ct);
        var rate = lib.Capacity > 0 ? (int)Math.Round((double)inside / lib.Capacity * 100) : 0;
        return new LibraryDetailSummaryDto(lib.Capacity, inside, rate, waiting, onBreak, 0);
    }

    public async Task<LibraryDto> CreateAsync(LibraryRequest req, CancellationToken ct)
    {
        var facilityId = ParseFacilityId(req.ServiceFacilityId);
        var lib = Library.Create(req.Name, facilityId);
        await ApplyRequestAsync(lib, req, facilityId, ct);

        await uow.Libraries.AddAsync(lib, ct);
        await uow.SaveChangesAsync(ct);

        await settingsService.ApplyLibraryOperationalAsync(lib.Id, req, ct);

        await GrantManagerAccessAsync(lib, req, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Library",
            EntityId = lib.Id,
            Module = "Library",
            Description = $"Kıraathane oluşturuldu: {lib.Name}",
            NewValues = JsonSerializer.Serialize(Snapshot(lib)),
        }, ct);

        return MapDto(lib, breakSystemEnabled: req.BreakSystemEnabled ?? true, autoCheckOutAfterMinutes: req.AutoCheckOutAfterMinutes);
    }

    public async Task<LibraryDto> UpdateAsync(Guid id, LibraryRequest req, CancellationToken ct)
    {
        var lib = await uow.Libraries.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var before = JsonSerializer.Serialize(Snapshot(lib));
        var facilityId = ParseFacilityId(req.ServiceFacilityId);
        await ApplyRequestAsync(lib, req, facilityId, ct);
        uow.Libraries.Update(lib);
        await uow.SaveChangesAsync(ct);

        await settingsService.ApplyLibraryOperationalAsync(lib.Id, req, ct);

        await GrantManagerAccessAsync(lib, req, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Library",
            EntityId = lib.Id,
            Module = "Library",
            Description = $"Kıraathane güncellendi: {lib.Name}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(lib)),
        }, ct);

        var libSettings = await settingsService.GetAsync(lib.Id, ct);
        return MapDto(lib, breakSystemEnabled: libSettings.BreakSystemEnabled, autoCheckOutAfterMinutes: libSettings.AutoCheckOutAfterMinutes);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var lib = await uow.Libraries.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        // NOT (2026-09-04, gerçek testte bulunan bug): Kütüphane silindiğinde bağlı
        // LibraryDevice kayıtları soft-delete edilmiyordu. Bu hem orphan cihaz kayıtları
        // bırakıyor hem de LibraryDevice.DeviceId üzerindeki global unique index'i
        // sonsuza dek işgal ediyordu (silinmiş kütüphanenin cihazı, başka bir kütüphanede
        // aynı DeviceId ile yeni cihaz oluşturmayı 409 DEVICE_ID_IN_USE ile engelliyordu).
        var devices = await uow.LibraryDevices.GetByLibraryAsync(id, ct);
        foreach (var device in devices)
            uow.LibraryDevices.Delete(device);

        // NOT (2026-09-04, gerçek testte bulunan bug #2, aynı kök nedenle): kütüphane
        // silinirken bağlı LibraryQueueEntry (waiting/called) ve LibraryReservation (held)
        // kayıtları da temizlenmiyordu. Sonuç: bir üyenin BAŞKA bir (artık silinmiş) kütüphanede
        // "waiting" durumunda kalıntı bir kuyruk kaydı kalıyor; bu üye YENİ bir kütüphanede
        // sıraya katılmaya çalıştığında JoinQueueAsync'teki GetActiveByParticipantAnyAsync bu
        // kalıntı kaydı bulup GetLibraryAsync(otherQueue.LibraryId) çağırıyor — kütüphane
        // silinmiş olduğundan NotFoundException("LIBRARY_NOT_FOUND") fırlatıyor. Kullanıcıya
        // yanıltıcı bir şekilde "kıraathane bulunamadı" hatası dönüyor, oysa gerçek sorun
        // BAŞKA bir kütüphanedeki kalıntı kayıt. E2E test suitini yazarken gerçek ortamda
        // karşılaşıldı (library-queue-flow.spec.ts).
        var queueEntries = await uow.LibraryQueue.GetActiveOrderedAsync(id, ct);
        foreach (var entry in queueEntries)
            entry.Cancel();
        if (queueEntries.Count > 0)
            uow.LibraryQueue.UpdateRange(queueEntries);

        var activeHolds = await uow.LibraryReservations.GetActiveHoldsByLibraryAsync(id, ct);
        foreach (var reservation in activeHolds)
            reservation.Cancel();
        if (activeHolds.Count > 0)
            uow.LibraryReservations.UpdateRange(activeHolds);

        uow.Libraries.Delete(lib);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Library",
            EntityId = lib.Id,
            Module = "Library",
            Description = $"Kıraathane silindi: {lib.Name}",
        }, ct);
    }

    public async Task<LibraryDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var lib = await uow.Libraries.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        lib.SetStatus(!lib.IsActive);
        uow.Libraries.Update(lib);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Library",
            EntityId = lib.Id,
            Module = "Library",
            Description = $"Kıraathane durumu değiştirildi: {lib.Name} → {(lib.IsActive ? "Aktif" : "Pasif")}",
        }, ct);

        return MapDto(lib);
    }

    public async Task<string> UploadKrokiAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct);
        return result.Url;
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct, "libraries");
        return result.Url;
    }

    private async Task ApplyRequestAsync(Library lib, LibraryRequest req, Guid facilityId, CancellationToken ct)
    {
        Domain.Entities.ServiceFacilities.ServiceFacility facility;
        if (facilityId == lib.ServiceFacilityId)
        {
            facility = (await uow.ServiceFacilities.FindIncludingDeletedAsync(f => f.Id == facilityId, ct)).FirstOrDefault()
                ?? throw new ConflictException("Seçilen hizmet tesisi bulunamadı.", "FACILITY_NOT_FOUND");
        }
        else
        {
            facility = await uow.ServiceFacilities.GetByIdAsync(facilityId, ct)
                ?? throw new ConflictException("Seçilen hizmet tesisi bulunamadı.", "FACILITY_NOT_FOUND");
        }

        lib.SetBasics(req.Name, req.Description);
        lib.SetImageUrl(req.ImageUrl);
        lib.SetFacility(facility.Id, facility.Name, facility.City, facility.District, facility.Address);
        await ApplyManagerAsync(lib, req, ct);

        var existingFloors = ParseLayout(lib.LayoutJson).Floors;
        var incoming = req.Floors;
        List<LibraryFloorDto> floors;
        if (incoming is { Count: > 0 })
        {
            var sectionsByFloor = existingFloors
                .Where(f => f.Sections is { Count: > 0 })
                .ToDictionary(f => f.Id, f => f.Sections!);
            floors = incoming
                .Select(f => f.Sections is { Count: > 0 }
                    ? f
                    : sectionsByFloor.TryGetValue(f.Id, out var sec) ? f with { Sections = sec } : f)
                .ToList();
        }
        else floors = existingFloors;

        var capacity = SeatStructure.TotalCapacity(floors);
        var isMultiFloor = floors.Count > 1 || req.IsMultiFloor;
        var layoutJson = JsonSerializer.Serialize(new { isMultiFloor, floors }, JsonOpts);
        lib.SetSeating(req.SeatingMode ?? "masali", capacity, floors.Count, isMultiFloor, layoutJson);
        lib.SetAreaType(req.AreaType ?? "mixed");

        // Kullanıcı isteği (2026-09-29, gerçek entegrasyon testiyle bulunan bulgu): ters yönde de
        // aynı çelişki mümkün — sabit QR zaten "entry_exit"/"split" modundayken biri giriş
        // kontrolünü "manual"a çevirirse aynı sessiz kilitlenme oluşur (bkz.
        // LibraryOperationsService.SetStaticQrModeAsync'teki ileri-yön guard'ı).
        var incomingEntryControlMode = req.EntryControlMode ?? "qr";
        if (incomingEntryControlMode == "manual" && lib.StaticQrEnabled && lib.StaticQrMode is "entry_exit" or "split")
            throw new ConflictException(
                "Sabit QR şu anda \"entry_exit\"/\"split\" modunda etkin olduğundan giriş kontrolü \"Manuel\"e çevrilemez. Önce sabit QR modunu \"Yoklama\"ya alın veya sabit QR'ı devre dışı bırakın.",
                "ENTRY_CONTROL_MODE_CONFLICT");
        var incomingSeatingMode = req.SeatingMode ?? "masali";
        if (incomingSeatingMode == "masali" && lib.StaticQrEnabled && lib.StaticQrMode is "entry_exit" or "split")
            throw new ConflictException(
                "Sabit QR şu anda \"entry_exit\"/\"split\" modunda etkin olduğundan koltuk düzeni \"Masalı\"ya çevrilemez (sabit QR isteği koltuk numarası taşımaz). Önce sabit QR modunu \"Yoklama\"ya alın veya sabit QR'ı devre dışı bırakın.",
                "SEATING_MODE_CONFLICT");

        lib.SetOperation(req.QueueEnabled, req.ReservationEnabled, req.EntryControlMode ?? "qr", req.ExitControlMode ?? "qr", req.DeviceControlEnabled);
        lib.SetAccessType(req.AccessType ?? (req.DeviceControlEnabled ? "device" : "qr"), req.DeviceKind);
        lib.SetAmenities(req.Amenities ?? []);
        lib.SetSecurity(req.IpRestrictionEnabled, req.AllowedIps ?? []);
        var latitude = req.GeofenceLatitude ?? facility.Latitude;
        var longitude = req.GeofenceLongitude ?? facility.Longitude;
        if (!Nexora.Application.Common.LocationAccessGuard.IsValid(latitude, longitude) || req.GeofenceRadiusMeters <= 0)
            throw new ConflictException("Kütüphane için geçerli koordinatlar ve QR okuma mesafesi zorunludur.", "LOCATION_NOT_CONFIGURED");
        // Kullanıcı isteği (2026-09-29, gerçek entegrasyon testiyle bulunan bulgu): burada daima
        // `true` yazılıyordu, req.GeofenceEnabled'a hiç bakılmıyordu (b6a6642, 21 Eylül'de
        // eklenmiş, sabit QR çalışmasıyla ilgisiz önceden var olan bug). Koordinat/mesafe HER ZAMAN
        // doğrulanır ve saklanır (yukarıdaki LOCATION_NOT_CONFIGURED kontrolü, static-scan'in
        // LocationAccessGuard.EnsureInside'ı zaten bayrağa bakmadan fail-closed çalışır) — ama
        // GeofenceEnabled bayrağının kendisi artık isteğin gerçek değerini yansıtır. Bu bayrak
        // yalnızca PERSONEL MESAİ BAŞLATMA konum kontrolünü (LibraryShiftService.EnforceGeofence)
        // açar/kapatır; sabit koordinatların kaydedilmesini etkilemez. Düzeltme öncesi bir yönetici
        // "konum kontrolü kapalı" seçse bile personel mesaisi her zaman konum istiyordu.
        lib.SetGeofence(req.GeofenceEnabled, latitude, longitude, req.GeofenceRadiusMeters);
        lib.SetStatus(req.IsActive);
        lib.SetResidencyMode(req.ResidencyMode);
    }

    private async Task ApplyManagerAsync(Library lib, LibraryRequest req, CancellationToken ct)
    {
        if (Guid.TryParse(req.ManagerId, out var managerId) && managerId != Guid.Empty)
        {
            var admin = await uow.AdminUsers.GetByIdAsync(managerId, ct)
                ?? throw new ConflictException("Seçilen yönetici bulunamadı.", "MANAGER_NOT_FOUND");
            var role = await uow.Roles.GetByIdAsync(admin.RoleId, ct);
            lib.SetManager(admin.Id, admin.FullName, admin.Phone, admin.Email, role?.Key, role?.Name ?? admin.FullName, req.EmergencyPhone);
        }
        else
        {
            lib.SetManager(null, req.Manager ?? "", req.ManagerPhone, req.ManagerEmail, req.ManagerRoleKey, req.ManagerRoleName, req.EmergencyPhone);
        }
    }

    private async Task GrantManagerAccessAsync(Library lib, LibraryRequest req, CancellationToken ct)
    {
        if (!req.GrantAccess || (Guid.TryParse(req.ManagerId, out var mid) && mid != Guid.Empty))
            return;

        if (string.IsNullOrWhiteSpace(req.Manager) || string.IsNullOrWhiteSpace(req.ManagerEmail))
            throw new ConflictException("Sisteme erişim verilecek kişinin adı ve e-postası zorunludur.", "STAFF_INFO_REQUIRED");

        var staff = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: req.Manager!,
            Tckn: req.Tckn,
            Phone: req.ManagerPhone,
            Email: req.ManagerEmail!,
            RoleTemplateKey: string.IsNullOrWhiteSpace(req.RoleTemplateKey) ? "kiraathane-sorumlusu" : req.RoleTemplateKey!,
            ScopeModuleKey: "library",
            ScopeRefId: lib.Id,
            ScopeName: lib.Name,
            ScopeType: "Library",
            DeliveryChannel: string.IsNullOrWhiteSpace(req.DeliveryChannel) ? "Email" : req.DeliveryChannel!), ct);

        lib.SetManager(staff.AdminUserId, staff.FullName, req.ManagerPhone, staff.Email, staff.RoleKey, staff.RoleName, req.EmergencyPhone);
        uow.Libraries.Update(lib);
        await uow.SaveChangesAsync(ct);
    }

    private static Guid ParseFacilityId(string value)
        => Guid.TryParse(value, out var id) ? id : throw new ConflictException("Hizmet tesisi seçilmelidir.", "FACILITY_REQUIRED");

    private static LibraryDto MapDto(Library l, int currentOccupancy = 0, int onBreakCount = 0, int waitingCount = 0, bool breakSystemEnabled = true, int autoCheckOutAfterMinutes = 0)
    {
        var layout = ParseLayout(l.LayoutJson);
        return new(
            l.Id, l.Name, l.Description, l.ImageUrl, l.ServiceFacilityId, l.ServiceFacilityName, l.District, l.City, l.Address,
            l.Capacity, currentOccupancy, waitingCount, onBreakCount, l.FloorCount, l.QueueEnabled, l.ReservationEnabled, l.DeviceControlEnabled, l.AccessType, l.DeviceKind, l.EntryControlMode, l.ExitControlMode,
            l.ManagerId, l.ManagerName, l.ManagerRoleKey, l.ManagerRoleName, l.ManagerPhone, l.IsActive, l.CreatedAt,
            layout.IsMultiFloor, layout.Floors, l.AreaType, l.Amenities,
            l.IpRestrictionEnabled, l.AllowedIps,
            l.GeofenceEnabled, l.GeofenceLatitude, l.GeofenceLongitude, l.GeofenceRadiusMeters,
            l.OperationTemplate, l.SeatingMode, breakSystemEnabled, autoCheckOutAfterMinutes, l.ResidencyMode);
    }

    public async Task<LibraryAnalyticsDto> GetAnalyticsAsync(LibraryAnalyticsParams p, CancellationToken ct)
    {
        var db = serviceProvider.GetRequiredService<Nexora.Infrastructure.Persistence.AppDbContext>();

        if (p.LibraryId.HasValue) await EnsureInScopeAsync(p.LibraryId.Value, ct);

        IReadOnlyCollection<Guid>? scopedIds = null;
        if (!p.LibraryId.HasValue && currentUser.Id is Guid analyticsUid)
        {
            var refIds = await userScope.GetScopedRefIdsAsync(analyticsUid, "library", ct);
            if (refIds is not null) scopedIds = [.. refIds];
        }

        var liveQuery = db.LibrarySessions.Where(s => !s.IsDeleted);
        if (p.LibraryId.HasValue) liveQuery = liveQuery.Where(s => s.LibraryId == p.LibraryId.Value);
        else if (scopedIds is not null)
        {
            var ids = scopedIds.ToList();
            liveQuery = liveQuery.Where(s => ids.Contains(s.LibraryId));
        }
        var activeNow = await liveQuery.CountAsync(s => s.Status == LibrarySessionStatus.Inside, ct);
        var onBreakNow = await liveQuery.CountAsync(s => s.Status == LibrarySessionStatus.OnBreakShort || s.Status == LibrarySessionStatus.OnBreakLong, ct);

        var waitingNow = p.LibraryId.HasValue
            ? await db.Set<Nexora.Domain.Entities.Libraries.LibraryQueueEntry>()
                .CountAsync(q => !q.IsDeleted && q.LibraryId == p.LibraryId.Value && q.Status == "waiting", ct)
            : await db.Set<Nexora.Domain.Entities.Libraries.LibraryQueueEntry>()
                .CountAsync(q => !q.IsDeleted && q.Status == "waiting", ct);

        var totalCapacity = p.LibraryId.HasValue
            ? await db.Set<Nexora.Domain.Entities.Libraries.Library>()
                .Where(l => !l.IsDeleted && l.Id == p.LibraryId.Value)
                .SumAsync(l => l.Capacity, ct)
            : await db.Set<Nexora.Domain.Entities.Libraries.Library>()
                .Where(l => !l.IsDeleted && l.IsActive)
                .SumAsync(l => l.Capacity, ct);
        var occupancyRateNow = totalCapacity > 0 ? Math.Round((double)activeNow / totalCapacity * 100, 1) : 0.0;

        var from = p.From is { } pf ? TurkeyTime.ToUtc(pf.Date) : TurkeyTime.TodayStartUtc();
        var to = p.To is { } pt ? TurkeyTime.ToUtc(pt.Date.AddDays(1)) : TurkeyTime.TodayStartUtc().AddDays(1);

        var sessionsQuery = db.LibrarySessions.Where(s => !s.IsDeleted && s.EntryTime >= from && s.EntryTime < to);
        if (p.LibraryId.HasValue) sessionsQuery = sessionsQuery.Where(s => s.LibraryId == p.LibraryId.Value);
        else if (scopedIds is not null)
        {
            var scopedList = scopedIds.ToList();
            sessionsQuery = sessionsQuery.Where(s => scopedList.Contains(s.LibraryId));
        }

        var sessions = await sessionsQuery
            .Select(s => new
            {
                s.LibraryId,
                s.MemberName,
                s.Tckn,
                s.EntryTime,
                s.ExitTime,
                BirthDate = s.BirthDate ?? db.Participants.Where(pp => pp.Id == s.ParticipantId || pp.Tckn == s.Tckn).Select(pp => (DateTime?)pp.BirthDate).FirstOrDefault(),
                s.ShortBreaksUsed,
                s.LongBreaksUsed,
                Gender = db.Participants.Where(pp => pp.Id == s.ParticipantId || pp.Tckn == s.Tckn).Select(pp => (Gender?)pp.Gender).FirstOrDefault(),
            })
            .ToListAsync(ct);

        var totalVisits = sessions.Count;
        var days = Math.Max(1, (to.Date - from.Date).TotalDays);
        var avgDailyVisits = Math.Round(totalVisits / days, 1);

        var completedSessions = sessions.Where(s => s.ExitTime.HasValue).ToList();
        var avgSessionMinutes = completedSessions.Count > 0
            ? Math.Round(completedSessions.Average(s => (s.ExitTime!.Value - s.EntryTime).TotalMinutes), 1)
            : 0.0;

        var avgBreaksPerSession = totalVisits > 0
            ? Math.Round(sessions.Average(s => s.ShortBreaksUsed + s.LongBreaksUsed), 2)
            : 0.0;

        var totalBreaks = sessions.Sum(s => s.ShortBreaksUsed + s.LongBreaksUsed);
        var breakRatePct = totalVisits > 0 ? Math.Round((double)sessions.Count(s => s.ShortBreaksUsed + s.LongBreaksUsed > 0) / totalVisits * 100, 1) : 0.0;

        var sessionsWithAge = sessions.Where(s => s.BirthDate.HasValue).ToList();
        double? avgAge = sessionsWithAge.Count > 0
            ? Math.Round(sessionsWithAge.Average(s => (DateTime.UtcNow - s.BirthDate!.Value).TotalDays / 365.25), 1)
            : null;

        var under18 = sessionsWithAge.Count(s => (DateTime.UtcNow - s.BirthDate!.Value).TotalDays / 365.25 < 18);
        var age18to25 = sessionsWithAge.Count(s => { var age = (DateTime.UtcNow - s.BirthDate!.Value).TotalDays / 365.25; return age >= 18 && age <= 25; });
        var age26to35 = sessionsWithAge.Count(s => { var age = (DateTime.UtcNow - s.BirthDate!.Value).TotalDays / 365.25; return age >= 26 && age <= 35; });
        var age36to50 = sessionsWithAge.Count(s => { var age = (DateTime.UtcNow - s.BirthDate!.Value).TotalDays / 365.25; return age >= 36 && age <= 50; });
        var over50 = sessionsWithAge.Count(s => (DateTime.UtcNow - s.BirthDate!.Value).TotalDays / 365.25 > 50);

        var libraryIds = sessions.Select(s => s.LibraryId).Distinct().ToList();
        var libraryNames = await db.Set<Nexora.Domain.Entities.Libraries.Library>()
            .Where(l => !l.IsDeleted && libraryIds.Contains(l.Id))
            .Select(l => new { l.Id, l.Name, l.Capacity })
            .ToListAsync(ct);
        var libraryNameMap = libraryNames.ToDictionary(l => l.Id, l => l.Name);
        var libraryCapMap = libraryNames.ToDictionary(l => l.Id, l => l.Capacity);

        var topLibraries = sessions
            .GroupBy(s => s.LibraryId)
            .Select(g => new TopLibraryDto(
                g.Key,
                libraryNameMap.GetValueOrDefault(g.Key, ""),
                g.Count(),
                libraryCapMap.TryGetValue(g.Key, out var cap) && cap > 0
                    ? Math.Round((double)g.Count() / days / cap * 100, 1)
                    : 0.0
            ))
            .OrderByDescending(x => x.VisitCount)
            .Take(5)
            .ToList();

        var topUsers = sessions
            .GroupBy(s => new { s.Tckn, s.MemberName })
            .Select(g =>
            {
                var userSessions = g.Where(s => s.ExitTime.HasValue).ToList();
                var avgMin = userSessions.Count > 0
                    ? Math.Round(userSessions.Average(s => (s.ExitTime!.Value - s.EntryTime).TotalMinutes), 1)
                    : 0.0;
                var tckn = g.Key.Tckn;
                var masked = tckn.Length >= 6 ? tckn[..3] + "****" + tckn[^3..] : "***";
                return new TopUserDto(g.Key.MemberName, masked, g.Count(), avgMin);
            })
            .OrderByDescending(x => x.VisitCount)
            .Take(10)
            .ToList();

        var yearStart = TurkeyTime.ToUtc(new DateTime(TurkeyTime.TodayDate().Year, 1, 1, 0, 0, 0, DateTimeKind.Unspecified));
        var yearQuery = db.LibrarySessions
            .Where(s => !s.IsDeleted && s.EntryTime >= yearStart && s.ExitTime.HasValue);
        if (p.LibraryId.HasValue)
        {
            var libId = p.LibraryId.Value;
            yearQuery = yearQuery.Where(s => s.LibraryId == libId);
        }
        else if (scopedIds is not null)
        {
            var scopedYearIds = scopedIds.ToList();
            yearQuery = yearQuery.Where(s => scopedYearIds.Contains(s.LibraryId));
        }
        var yearSessions = await yearQuery
            .Select(s => new { s.Tckn, s.MemberName, s.EntryTime, s.ExitTime })
            .ToListAsync(ct);

        var topUsersByHours = yearSessions
            .GroupBy(s => new { s.Tckn, s.MemberName })
            .Select(g =>
            {
                var totalHours = Math.Round(g.Sum(s => (s.ExitTime!.Value - s.EntryTime).TotalHours), 1);
                var tckn = g.Key.Tckn;
                var masked = tckn.Length >= 6 ? tckn[..3] + "****" + tckn[^3..] : "***";
                return new TopUserByHoursDto(g.Key.MemberName, masked, totalHours, g.Count());
            })
            .OrderByDescending(x => x.TotalHours)
            .Take(10)
            .ToList();

        var maleCount = sessions.Count(s => s.Gender == Gender.Male);
        var femaleCount = sessions.Count(s => s.Gender == Gender.Female);

        var hourlyLoad = Enumerable.Range(0, 24)
            .Select(h => new HourlyLoadDto(h, sessions.Count(s => s.EntryTime.Hour == h)))
            .ToList();

        // Kullanıcı isteği (2026-10-05): eski MySQL Millet Kıraathanesi sisteminden içe
        // aktarılmış tüm-zamanlar kullanım istatistiği — dönem filtresinden bağımsız, her
        // zaman en çok kullanan 10 kişiyi gösterir. İsim güncel Participants kaydından
        // (varsa) çekilir; eşleşmezse "Bilinmiyor (eski kayıt)" gösterilir.
        var legacyTop = await db.Set<Nexora.Domain.Entities.Libraries.LibraryLegacyUsageStat>()
            .OrderByDescending(x => x.TotalVisits)
            .Take(10)
            .Select(x => new { x.Tckn, x.TotalVisits, x.TotalHours, x.FirstVisitAt, x.LastVisitAt, x.PrimaryLocationName })
            .ToListAsync(ct);
        var legacyTcknList = legacyTop.Select(x => x.Tckn).ToList();
        var legacyNameMap = await db.Participants
            .Where(p => legacyTcknList.Contains(p.Tckn))
            .Select(p => new { p.Tckn, p.FullName })
            .ToDictionaryAsync(p => p.Tckn, p => p.FullName, ct);
        var legacyTopUsers = legacyTop
            .Select(x =>
            {
                var matched = legacyNameMap.TryGetValue(x.Tckn, out var fullName);
                var masked = x.Tckn.Length >= 6 ? x.Tckn[..3] + "****" + x.Tckn[^3..] : "***";
                return new LegacyTopUserDto(
                    matched ? fullName! : "Bilinmiyor (eski kayıt)",
                    masked, x.TotalVisits, x.TotalHours, x.FirstVisitAt, x.LastVisitAt, x.PrimaryLocationName, matched);
            })
            .ToList();

        // Kullanıcı isteği (2026-10-05, devam): eski sistemi kullanmış TÜM kişilerin (17.572,
        // yalnız top-10 değil) cinsiyet/yaş/mahalle kırılımı. LibraryLegacyUsageStats, eski
        // sistemdeki her TCKN için TEK satırdır — bu yüzden "benzersiz kullanıcı" sayımı burada
        // doğal olarak doğru (LibrarySessions'ta aynı kişi için çok satır olabilir, orada böyle
        // bir join yapılmaz). Yalnızca güncel Participants'ta GERÇEKTEN eşleşenler demografiye
        // girer — eşleşmeyen ~4 kayıt (17572'den 17568'e) es geçilir, uydurma veri üretilmez.
        var legacyParticipantRows = await (
            from legacy in db.Set<Nexora.Domain.Entities.Libraries.LibraryLegacyUsageStat>()
            join part in db.Participants on legacy.Tckn equals part.Tckn
            select new { part.Gender, part.BirthDate, part.Address }
        ).ToListAsync(ct);

        var legacyAgeBandDefs = new (string Band, int MinAge, int MaxAge)[]
        {
            ("0-12", 0, 12), ("13-17", 13, 17), ("18-25", 18, 25),
            ("26-40", 26, 40), ("41-60", 41, 60), ("60+", 61, 200),
        };
        static int AgeOf(DateTime birth)
        {
            var today = TurkeyTime.TodayDate();
            var age = today.Year - birth.Year;
            if (birth.Date > today.AddYears(-age)) age--;
            return age;
        }

        Nexora.Application.Features.Participants.Dtos.ParticipantDemographicsOverviewDto? legacyUserDemographics = null;
        if (legacyParticipantRows.Count > 0)
        {
            var lTotal = legacyParticipantRows.Count;
            var lMale = legacyParticipantRows.Count(r => r.Gender == Gender.Male);
            var lFemale = legacyParticipantRows.Count(r => r.Gender == Gender.Female);
            var lAges = legacyParticipantRows.Select(r => AgeOf(r.BirthDate)).ToList();
            var lMinors = lAges.Count(a => a < 18);
            var lAdults = lTotal - lMinors;
            var lAvgAge = lAges.Count > 0 ? lAges.Average() : 0;

            var lAgeBands = legacyAgeBandDefs.Select(b =>
            {
                var inBand = legacyParticipantRows.Where(r => { var a = AgeOf(r.BirthDate); return a >= b.MinAge && a <= b.MaxAge; }).ToList();
                return new Nexora.Application.Features.Participants.Dtos.AgeBandStatDto(
                    b.Band, inBand.Count,
                    inBand.Count(r => r.Gender == Gender.Male),
                    inBand.Count(r => r.Gender == Gender.Female),
                    lTotal > 0 ? Math.Round(inBand.Count * 100.0 / lTotal, 1) : 0);
            }).ToList();

            var lNeighborhoods = legacyParticipantRows
                .GroupBy(r => Nexora.Domain.Common.BakirkoyNeighborhoods.Classify(r.Address))
                .Select(g =>
                {
                    var items = g.Select(r => (r.Gender, Age: AgeOf(r.BirthDate))).ToList();
                    var count = items.Count;
                    var youth = items.Where(x => x.Age >= 15 && x.Age <= 29).ToList();
                    var bands = legacyAgeBandDefs.Select(b =>
                    {
                        var inBand = items.Where(x => x.Age >= b.MinAge && x.Age <= b.MaxAge).ToList();
                        return new Nexora.Application.Features.Participants.Dtos.AgeBandStatDto(
                            b.Band, inBand.Count,
                            inBand.Count(x => x.Gender == Gender.Male),
                            inBand.Count(x => x.Gender == Gender.Female),
                            count > 0 ? Math.Round(inBand.Count * 100.0 / count, 1) : 0);
                    }).ToList();
                    return new Nexora.Application.Features.Participants.Dtos.NeighborhoodStatDto(
                        g.Key, count,
                        items.Count(x => x.Gender == Gender.Male),
                        items.Count(x => x.Gender == Gender.Female),
                        items.Count(x => x.Age < 18),
                        items.Count(x => x.Age >= 18),
                        lTotal > 0 ? Math.Round(count * 100.0 / lTotal, 1) : 0,
                        bands,
                        youth.Count,
                        youth.Count(x => x.Gender == Gender.Male),
                        youth.Count(x => x.Gender == Gender.Female),
                        count > 0 ? Math.Round(youth.Count * 100.0 / count, 1) : 0);
                })
                .OrderByDescending(n => n.Total)
                .ToList();

            legacyUserDemographics = new Nexora.Application.Features.Participants.Dtos.ParticipantDemographicsOverviewDto(
                lTotal, 0, 0, 0, 0, 0, lMinors, lAdults, 0, Math.Round(lAvgAge, 1),
                new Nexora.Application.Features.Participants.Dtos.GenderStatDto(
                    lMale, lFemale,
                    lTotal > 0 ? Math.Round(lMale * 100.0 / lTotal, 1) : 0,
                    lTotal > 0 ? Math.Round(lFemale * 100.0 / lTotal, 1) : 0),
                lNeighborhoods, lAgeBands, lAgeBands);
        }

        return new LibraryAnalyticsDto(
            activeNow, onBreakNow, waitingNow, occupancyRateNow,
            totalVisits, avgDailyVisits, avgSessionMinutes, avgBreaksPerSession,
            avgAge, under18, age18to25, age26to35, age36to50, over50,
            maleCount, femaleCount,
            topLibraries, topUsers, topUsersByHours,
            totalBreaks, breakRatePct, hourlyLoad,
            legacyTopUsers, legacyUserDemographics
        );
    }

    private static LibraryLayoutDto ParseLayout(string? json)
        => string.IsNullOrWhiteSpace(json)
            ? new LibraryLayoutDto(false, [])
            : JsonSerializer.Deserialize<LibraryLayoutDto>(json, JsonOpts) ?? new LibraryLayoutDto(false, []);

    private static object Snapshot(Library l) => new
    {
        l.Name,
        l.ServiceFacilityName,
        l.Capacity,
        l.FloorCount,
        l.SeatingMode,
        l.IsActive,
    };
}
