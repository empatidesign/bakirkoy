using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using System.Text.Json;
using System.Text.Json.Nodes;
using Nexora.Domain.Common;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class EventService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IServiceProvider serviceProvider,
    IOptionsMonitor<MinioSettings> minioOptions,
    IActivityLogger log,
    IAuditService audit,
    IParticipantNotificationService participantNotify,
    IUserScopeService scopeService,
    IScopedStaffService scopedStaff) : IEventService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    // Salonlar (HallService/SessionService) ve Facility* servislerindeki EnsureInScopeAsync
    // desenini yansıtıyor. GetPagedAsync zaten liste seviyesinde scopedIds ile filtreleniyordu,
    // ama tek-kayıt uç noktalarının (GetById/Update/Delete/Restore/PermanentDelete/Copy/
    // ToggleStatus/SeatPlan/AuditLog) hiçbiri id bazlı scope kontrolü yapmıyordu — tesise
    // sınırlı bir "Etkinlik Yöneticisi" başka tüm etkinlikleri ID bilerek görüntüleyip/
    // değiştirebilirdi (Spor Salonu Madde 13 ile aynı sınıf açık).
    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedIds = await scopeService.GetScopedRefIdsAsync(uid, "events", ct);
        if (scopedIds is not null && !scopedIds.Contains(id))
            throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");
    }

    public async Task<PagedResult<EventDto>> GetPagedAsync(EventListParams p, CancellationToken ct)
    {
        var scopedIds = await scopeService.GetScopedRefIdsAsync(currentUser.Id ?? Guid.Empty, "events", ct);
        if (scopedIds is not null && scopedIds.Count == 0)
            return new PagedResult<EventDto> { Items = [], Total = 0, Page = p.PageResolved, Limit = p.LimitResolved };

        var paged = await uow.Events.GetPagedAsync(p, ct, scopedIds);
        return await MapPageAsync(paged, ct);
    }

    public async Task<PagedResult<EventDto>> GetTrashAsync(EventListParams p, CancellationToken ct)
    {
        var scopedIds = await scopeService.GetScopedRefIdsAsync(currentUser.Id ?? Guid.Empty, "events", ct);
        if (scopedIds is not null && scopedIds.Count == 0)
            return new PagedResult<EventDto> { Items = [], Total = 0, Page = p.PageResolved, Limit = p.LimitResolved };

        var paged = await uow.Events.GetTrashAsync(p, ct);

        if (scopedIds is not null)
        {
            var filtered = paged.Items.Where(e => scopedIds.Contains(e.Id)).ToList();
            return await MapPageAsync(new PagedResult<Event> { Items = filtered, Total = filtered.Count, Page = paged.Page, Limit = paged.Limit }, ct);
        }

        return await MapPageAsync(paged, ct);
    }

    public async Task<EventSummaryDto> GetSummaryAsync(EventListParams p, CancellationToken ct)
    {
        var (total, active, registered, capacity) = await uow.Events.GetSummaryAsync(p, ct);
        return new EventSummaryDto(total, active, total - active, registered, capacity);
    }

    public async Task<List<EventOptionDto>> GetOptionsAsync(string? search, CancellationToken ct)
    {
        var events = await uow.Events.GetOptionsAsync(search, ct);
        return events.Select(e => new EventOptionDto(e.Id, e.Name, e.StartDate, e.EndDate)).ToList();
    }

    public async Task<EventDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var ev = await uow.Events.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");
        return await ToDtoAsync(ev, ct);
    }

    public async Task<EventDto> CreateAsync(EventFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (!await uow.EventCategories.AnyAsync(c => c.Id == req.CategoryId, ct))
            throw new NotFoundException("Kategori bulunamadı.", "EVENT_CATEGORY_NOT_FOUND");

        if (req.FacilityId.HasValue && !await uow.ServiceFacilities.AnyAsync(f => f.Id == req.FacilityId.Value, ct))
            throw new NotFoundException("Hizmet tesisi bulunamadı.", "FACILITY_NOT_FOUND");

        if (TurkeyTime.ToTurkey(req.StartDate).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş tarihli etkinlik oluşturulamaz.", "PAST_DATE");

        ValidateApplicationWindow(req.ApplicationStartDate, req.ApplicationEndDate);

        await EnsureCapacityWithinHallAsync(req.HallId, req.Capacity, ct);

        var code = $"EVT-{await uow.Events.NextCodeNumberAsync(ct):D6}";
        var ev = Event.Create(ToData(req), code, currentUser.Name);

        if (req.Access.HasSeating && req.HallId.HasValue)
        {
            var hall = await uow.Halls.GetByIdAsync(req.HallId.Value, ct);
            if (hall is not null) ev.SetSeatStates(hall.SeatStatesJson);
        }

        if (req.Access.HasSessions)
            ev.Deactivate();

        await uow.Events.AddAsync(ev, ct);
        await uow.SaveChangesAsync(ct);

        await GrantResponsibleAccessAsync(ev, req.Responsible, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Event",
            EntityId = ev.Id,
            Module = "Events",
            Description = $"Etkinlik oluşturuldu: {ev.Name}",
        }, ct);

        return await ToDtoAsync(ev, ct);
    }

    public async Task<EventDto> UpdateAsync(Guid id, EventFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });
        await EnsureInScopeAsync(id, ct);

        var ev = await uow.Events.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        if (!await uow.EventCategories.AnyAsync(c => c.Id == req.CategoryId, ct))
            throw new NotFoundException("Kategori bulunamadı.", "EVENT_CATEGORY_NOT_FOUND");

        ValidateApplicationWindow(req.ApplicationStartDate, req.ApplicationEndDate);

        await EnsureCapacityWithinHallAsync(req.HallId, req.Capacity, ct);

        var previousStartDate = ev.StartDate;
        var previousEndDate = ev.EndDate;
        var previousCapacity = ev.Capacity;
        var oldValues = JsonSerializer.Serialize(await ToDtoAsync(ev, ct));

        var today = TurkeyTime.TodayDate();
        var isPastEvent = previousStartDate.Date < today && previousEndDate.Date < today;

        // Kullanıcı talebi: hem başlangıç hem bitiş tarihi geçmiş (tamamen bitmiş) bir
        // etkinlik artık düzenlenemez — süper admin hariç, veri durumundan bağımsız
        // olarak koşulsuz uygulanır (bkz. görev talimatı).
        if (isPastEvent && !currentUser.IsSuperAdmin)
            throw new ForbiddenException("Süresi dolmuş etkinlikler yalnızca süper yönetici tarafından düzenlenebilir.", "EVENT_PAST_SUPERADMIN_ONLY");

        // Bu kilit gerçek katılımcı/seans verisini (başvurular, oluşturulmuş seanslar) korumak
        // için var. Henüz kimsenin başvurmadığı ve seansı olmayan bir kayıt (ör. Kopyala ile
        // yeni oluşturulmuş, henüz tarihleri güncellenmemiş bir taslak) korunacak hiçbir veriye
        // sahip değildir — bu yüzden bu kilidi yalnızca gerçek veri varsa uyguluyoruz.
        var hasRealData = ev.SessionCount > 0
            || await uow.EventApplications.AnyAsync(a => a.EventId == id && a.Status != "rejected" && a.Status != "cancelled", ct);

        if (!isPastEvent && hasRealData && previousStartDate.Date <= today && req.StartDate.Date != previousStartDate.Date)
            throw new ConflictException("Başlamış etkinliğin başlangıç tarihi değiştirilemez; yalnızca bitiş tarihi güncellenebilir.", "EVENT_STARTED_START_LOCKED");

        ev.Update(ToData(req), currentUser.Name);

        if (req.Access.HasSessions && ev.SessionCount == 0)
            ev.Deactivate();

        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);

        await GrantResponsibleAccessAsync(ev, req.Responsible, ct);

        // UAT 2026-09-24: EndDate UTC saklanır (TR gece yarısı = önceki gün 21:00Z); `.Date`
        // doğrudan alınınca son gün bir gün geri kayıyordu — TR takvim gününe çevrilir.
        var prevEndDay = TurkeyTime.ToTurkey(previousEndDate).Date;
        var newEndDay = TurkeyTime.ToTurkey(ev.EndDate).Date;
        if (newEndDay > prevEndDay && !string.IsNullOrWhiteSpace(ev.SessionScheduleJson))
            await serviceProvider.GetRequiredService<ISessionService>()
                .RegenerateForRangeAsync(ev.Id, prevEndDay.AddDays(1), newEndDay, ct);
        else if (newEndDay < prevEndDay)
            await serviceProvider.GetRequiredService<ISessionService>()
                .DeleteAfterDateAsync(ev.Id, newEndDay, ct);

        if (ev.Capacity != previousCapacity)
            await serviceProvider.GetRequiredService<ISessionService>()
                .PropagateEventCapacityAsync(ev.Id, ev.Capacity, ct);

        var newDto = await ToDtoAsync(ev, ct);
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Event",
            EntityId = ev.Id,
            Module = "Events",
            Description = $"Etkinlik güncellendi: {ev.Name}",
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(newDto),
        }, ct);

        return newDto;
    }

    private async Task EnsureCapacityWithinHallAsync(Guid? hallId, int capacity, CancellationToken ct)
    {
        if (!hallId.HasValue) return;
        var hall = await uow.Halls.GetByIdAsync(hallId.Value, ct);
        if (hall is null) return;
        var openSeats = SeatMath.OpenSeats(hall.Capacity, hall.SeatStatesJson);
        if (capacity > openSeats)
            throw new ConflictException($"Kontenjan salonun kullanılabilir koltuk sayısından ({openSeats}) büyük olamaz.", "CAPACITY_EXCEEDS_HALL");
    }

    public async Task<Dictionary<string, string>> GetSeatPlanAsync(Guid eventId, CancellationToken ct)
    {
        await EnsureInScopeAsync(eventId, ct);
        var ev = await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var states = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(ev.SeatStatesJson))
            states = JsonSerializer.Deserialize<Dictionary<string, string>>(ev.SeatStatesJson, JsonOpts) ?? [];
        else if (ev.HallId is Guid hallId)
        {
            var hall = await uow.Halls.GetByIdAsync(hallId, ct);
            if (!string.IsNullOrWhiteSpace(hall?.SeatStatesJson))
                states = JsonSerializer.Deserialize<Dictionary<string, string>>(hall.SeatStatesJson, JsonOpts) ?? [];
        }

        var occupied = await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId == null && a.SeatNumber != null && a.Status != "rejected" && a.Status != "cancelled", ct);
        foreach (var a in occupied)
            if (a.SeatNumber is not null && !states.ContainsKey(a.SeatNumber))
                states[a.SeatNumber] = "reserved";

        return states;
    }

    public async Task SaveSeatPlanAsync(Guid eventId, SeatPlanRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(eventId, ct);
        var ev = await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var hall = ev.HallId is Guid hallId ? await uow.Halls.GetByIdAsync(hallId, ct) : null;
        var prevSeatJson = ev.SeatStatesJson;
        var holds = req.States
            .Where(kv => kv.Value is "protocol" or "closed")
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var apps = (await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId == null && a.Status == "approved" && a.SeatNumber != null, ct)).ToList();
        var relo = SeatReconciler.Relocate(holds, hall?.LayoutJson, apps);
        foreach (var app in relo.Touched) uow.EventApplications.Update(app);

        var seatJson = holds.Count == 0 ? null : JsonSerializer.Serialize(holds);
        ev.SetSeatStates(seatJson);
        if (hall is not null)
        {
            var newOpen = SeatMath.OpenSeats(hall.Capacity, seatJson);
            var prevOpen = SeatMath.OpenSeats(hall.Capacity, prevSeatJson);
            if (ev.Capacity == prevOpen) ev.SetCapacity(newOpen);
            else if (ev.Capacity > newOpen) ev.SetCapacity(newOpen);
        }
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);

        var seatContext = $"{ev.Name} ({ev.StartDate:dd.MM.yyyy})";
        foreach (var move in relo.Moves)
        {
            log.LogStep("SeatRelocation", new { eventId, move.ParticipantId, move.OldSeats, move.NewSeats, move.Manual });
            await audit.LogAsync(SeatReconciler.BuildMoveAudit(ev.Code, "Event", ev.Id, "Events", move), ct);
            await participantNotify.NotifySeatMoveAsync(move.ParticipantId, seatContext, move.OldSeats, move.NewSeats, move.Manual, ct);
        }
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var ev = await uow.Events.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var sessions = (await uow.Sessions.FindAsync(s => s.EventId == id, ct)).ToList();
        if (sessions.Count > 0) uow.Sessions.DeleteRange(sessions);

        var pids = (await uow.EventApplications.FindAsync(a => a.EventId == id && a.Status != "cancelled", ct))
            .Select(a => a.ParticipantId).Distinct().ToList();

        ev.MarkDeleted(currentUser.Name);
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.SoftDelete,
            EntityType = "Event",
            EntityId = ev.Id,
            Module = "Events",
            Description = $"Etkinlik silindi (çöp kutusuna taşındı): {ev.Name}",
        }, ct);

        await participantNotify.NotifyAsync(pids, $"{ev.Name} etkinliği iptal edilmiştir.", ct);
    }

    public async Task<EventDto> RestoreAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var ev = await uow.Events.GetAnyByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        if (!ev.IsDeleted)
            throw new ConflictException("Etkinlik zaten arşivde değil.", "EVENT_NOT_DELETED");

        ev.Restore();
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Restore,
            EntityType = "Event",
            EntityId = ev.Id,
            Module = "Events",
            Description = $"Etkinlik çöp kutusundan geri yüklendi: {ev.Name}",
        }, ct);

        return await ToDtoAsync(ev, ct);
    }

    public async Task PermanentDeleteAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var ev = await uow.Events.GetAnyByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        if (!ev.IsDeleted)
            throw new ConflictException("Kalıcı silmeden önce etkinlik çöp kutusunda olmalıdır.", "EVENT_NOT_IN_TRASH");

        var evName = ev.Name;
        var evId = ev.Id;
        uow.Events.HardRemove(ev);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Event",
            EntityId = evId,
            Module = "Events",
            Description = $"Etkinlik kalıcı olarak silindi: {evName}",
        }, ct);
    }

    public async Task<EventDto> CopyAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var src = await uow.Events.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        // Kaynak etkinlik tamamen geçmişte kalmışsa (başlangıç VE bitiş < bugün), kopyayı
        // aynı geçmiş tarihlerle oluşturmuyoruz: UpdateAsync'teki "süresi dolmuş etkinlik
        // yalnızca süper yönetici tarafından düzenlenebilir" kilidi (EVENT_PAST_SUPERADMIN_ONLY)
        // tarih alanından bağımsız çalışır, dolayısıyla geçmiş tarihli bir kopya normal bir
        // admin için anında düzenlenemez hale gelirdi — bu da "kopyaladığımızda ... başlangıç
        // ve bitiş tarihi değiştirilebilir olsun" talebini bozar. Kopya zaten pasif (taslak)
        // olarak oluşturulduğundan tarihleri bugüne çekmek güvenlidir; admin gerçek tarihleri
        // düzenleme ekranında hemen seçer.
        var today = TurkeyTime.TodayDate();
        var wasFullyPast = src.StartDate.Date < today && src.EndDate.Date < today;
        // Süreyi (bitiş - başlangıç) koruyarak tüm aralığı bugüne kaydırıyoruz, tek günlük
        // etkinliklerde ikisi de today olur.
        var duration = src.EndDate.Date - src.StartDate.Date;
        var copyStartDate = wasFullyPast ? today : src.StartDate;
        var copyEndDate = wasFullyPast ? today.Add(duration) : src.EndDate;

        var copy = await CreateCopyCoreAsync(src, copyStartDate, copyEndDate, null, null, ct);
        return await ToDtoAsync(copy, ct);
    }

    // Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — tek işlemde birden fazla
    // hedef tarih aralığı için bağımsız etkinlik kopyaları oluşturur. Travel.BulkCopyAsync /
    // FacilityGroup.CopyAsync ile aynı "best-effort" deseni: bir hedef başarısız olursa diğerleri
    // etkilenmez, sonuç listesinde ayrı ayrı raporlanır.
    public async Task<EventBulkCopyResult> BulkCopyAsync(Guid id, EventBulkCopyRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var src = await uow.Events.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var targets = req.Targets ?? [];
        if (targets.Count == 0)
            throw new ConflictException("En az bir hedef tarih aralığı girilmelidir.", "COPY_TARGETS_EMPTY");

        var results = new List<EventBulkCopyItemResult>();
        for (var i = 0; i < targets.Count; i++)
        {
            var t = targets[i];
            try
            {
                if (t.EndDate.Date < t.StartDate.Date)
                    throw new ConflictException("Bitiş tarihi başlangıç tarihinden önce olamaz.", "EVENT_DATE_INVALID");
                var copy = await CreateCopyCoreAsync(src, t.StartDate, t.EndDate, t.ApplicationStartDate, t.ApplicationEndDate, ct);
                results.Add(new EventBulkCopyItemResult(i, true, copy.Id, copy.Code, null));
            }
            catch (Exception ex) when (ex is ConflictException or NotFoundException)
            {
                results.Add(new EventBulkCopyItemResult(i, false, null, null, ex.Message));
            }
        }

        return new EventBulkCopyResult(results);
    }

    private async Task<Event> CreateCopyCoreAsync(
        Event src, DateTime startDate, DateTime endDate,
        DateTime? applicationStartDate, DateTime? applicationEndDate, CancellationToken ct)
    {
        var data = new EventData(
            $"{src.Name} (Kopya)", src.CategoryId, src.VenueType, src.FacilityId, src.HallId, src.LocationJson,
            startDate, endDate, src.IsSingleDay, src.Gender, src.Capacity, src.ReserveCapacity,
            src.MinAge, src.MaxAge, src.ParticipationPeriod, src.ParticipationLimit, src.Description, src.InternalNote,
            src.ImagesJson, src.AccessJson, src.PricingJson, src.PointsJson, false, src.SultangaziResidentOnly, src.StartTime, src.EndTime, src.ResidencyMode,
            applicationStartDate ?? src.ApplicationStartDate, applicationEndDate ?? src.ApplicationEndDate);

        var code = $"EVT-{await uow.Events.NextCodeNumberAsync(ct):D6}";
        var copy = Event.Create(data, code, currentUser.Name);
        copy.Deactivate();

        await uow.Events.AddAsync(copy, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Event",
            EntityId = copy.Id,
            Module = "Events",
            Description = $"Etkinlik kopyalandı: {copy.Name} (kaynak: {src.Name})",
        }, ct);

        return copy;
    }

    public async Task<EventDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var ev = await uow.Events.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        if (ev.IsActive)
        {
            ev.Deactivate();
        }
        else
        {
            var access = JsonSerializer.Deserialize<EventAccessConfigDto>(ev.AccessJson, JsonOpts);
            if (access is not null && access.HasSessions && ev.SessionCount == 0)
                throw new ConflictException("Seans yapısı seçili etkinlik, en az bir seans eklenmeden yayınlanamaz veya aktif edilemez.", "EVENT_REQUIRES_SESSION");
            ev.Activate();
        }

        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Event",
            EntityId = ev.Id,
            Module = "Events",
            Description = ev.IsActive
                ? $"Etkinlik aktifleştirildi: {ev.Name}"
                : $"Etkinlik pasifleştirildi: {ev.Name}",
        }, ct);

        return await ToDtoAsync(ev, ct);
    }

    public async Task<List<EventAuditEntryDto>> GetAuditLogAsync(Guid id, CancellationToken ct)
    {
        await EnsureInScopeAsync(id, ct);
        var logs = await uow.AuditLogs.FindAsync(a => a.EntityType == "Event" && a.EntityId == id, ct);
        return logs
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new EventAuditEntryDto(a.Id, MapAction(a.Action), a.CreatedAt, a.UserName ?? "Sistem", a.Description))
            .ToList();
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, string? purpose, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");

        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        var settingsService = serviceProvider.GetService<IEventSettingsService>();
        if (settingsService is not null)
        {
            var settings = await settingsService.GetAsync(ct);
            ImageSpecGuard.Validate(bytes, purpose, settings.Images);
        }

        var bucket = minioOptions.CurrentValue.PublicBucket;
        using var upload = new MemoryStream(bytes);
        var result = await storage.UploadAsync(upload, fileName, contentType, bucket, ct);
        return result.Url;
    }

    private static void ValidateApplicationWindow(DateTime? applicationStartDate, DateTime? applicationEndDate)
    {
        if (applicationStartDate.HasValue && applicationEndDate.HasValue && applicationEndDate.Value < applicationStartDate.Value)
            throw new ConflictException(
                "Başvuru bitiş tarihi, başvuru başlangıç tarihinden önce olamaz.",
                "APPLICATION_WINDOW_INVALID");
    }

    private static EventData ToData(EventFormRequest r)
    {
        var accessJson = JsonSerializer.Serialize(r.Access, JsonOpts);
        var locationJson = r.Location is null ? null : JsonSerializer.Serialize(r.Location, JsonOpts);
        var imagesJson = RawOrEmpty(r.Images);
        var pricingJson = RawOrEmpty(r.Pricing);
        var pointsJson = RawOrEmpty(r.Points);
        var responsibleJson = r.Responsible is JsonElement re ? RawOrEmpty(re) : null;

        return new EventData(
            r.Name, r.CategoryId, r.VenueType, r.FacilityId, r.HallId, locationJson,
            r.StartDate, r.EndDate, r.IsSingleDay, r.Gender, r.Capacity, r.ReserveCapacity,
            r.MinAge, r.MaxAge, r.ParticipationPeriod, r.ParticipationLimit, r.Description ?? "", r.InternalNote ?? "",
            imagesJson, accessJson, pricingJson, pointsJson, r.IsActive, r.SultangaziResidentOnly, r.StartTime, r.EndTime, r.ResidencyMode,
            NormalizeApplicationDate(r.ApplicationStartDate), NormalizeApplicationDate(r.ApplicationEndDate), responsibleJson);
    }

    // Travel modülündeki GrantGuideAccessAsync (Gezi Sorumlusu) deseninin birebir karşılığı —
    // kullanıcı isteği (2026-09-20): her ana modül yöneticisi kendi bölümüne özel, tek bir
    // etkinlikle sınırlı (scoped) sorumlu/alt kullanıcı tanımlayabilsin. "Sisteme erişim ver"
    // işaretlenmemişse yalnızca iletişim kişisi olarak kaydedilir, hesap açılmaz.
    private async Task GrantResponsibleAccessAsync(Event ev, JsonElement? responsibleOpt, CancellationToken ct)
    {
        if (responsibleOpt is not JsonElement responsible || responsible.ValueKind != JsonValueKind.Object) return;
        if (!ReadBool(responsible, "grantAccess")) return;

        var existingId = ReadString(responsible, "id");
        if (Guid.TryParse(existingId, out var existingGuid) && existingGuid != Guid.Empty) return;

        var name = ReadString(responsible, "name");
        var email = ReadString(responsible, "email");
        var phone = ReadString(responsible, "phone");
        var tckn = ReadString(responsible, "tckn");

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email))
            throw new ConflictException("Sisteme erişim verilecek kişinin adı ve e-postası zorunludur.", "STAFF_INFO_REQUIRED");

        var staff = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: name,
            Tckn: string.IsNullOrWhiteSpace(tckn) ? null : tckn,
            Phone: string.IsNullOrWhiteSpace(phone) ? null : phone,
            Email: email,
            RoleTemplateKey: "etkinlik-sorumlusu",
            ScopeModuleKey: "events",
            ScopeRefId: ev.Id,
            ScopeName: ev.Name,
            ScopeType: "Event",
            DeliveryChannel: "Email"), ct);

        var node = JsonNode.Parse(responsible.GetRawText())!.AsObject();
        node["id"] = staff.AdminUserId.ToString();
        node["roleKey"] = staff.RoleKey;
        node["role"] = staff.RoleName;

        ev.SetResponsibleJson(node.ToJsonString(), currentUser.Name);
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);
    }

    private static bool ReadBool(JsonElement obj, string property)
    {
        if (!obj.TryGetProperty(property, out var el)) return false;
        return el.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.String => bool.TryParse(el.GetString(), out var b) && b,
            _ => false,
        };
    }

    private static string ReadString(JsonElement obj, string property)
        => obj.TryGetProperty(property, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() ?? "" : "";

    // Bağımsız doğrulama sırasında bulundu: EventFormRequest.ApplicationStartDate/EndDate bir
    // istemciden offset'li ISO 8601 (örn. "2026-08-05T00:00:00+03:00") olarak gelirse,
    // System.Text.Json bunu DateTimeKind.Utc'ye çevirip saklıyor, ama EventApplicationWindow.Check
    // sadece ".Date" karşılaştırması yapıyor (Facility modülüyle aynı desen) — bu da offset'in gün
    // sınırını kaydırmasına ve yanlış gün karşılaştırmasına yol açabiliyordu (canlı testte
    // kanıtlandı). Gerçek admin panel DatePicker'ı zaten offset'siz "YYYY-MM-DD" gönderdiği için
    // (bkz. admin-panel/src/design-system/DatePicker/DatePicker.tsx buildValue) bu üretimde hiç
    // tetiklenmiyor, ama API'yi doğrudan çağıran herhangi bir istemciye (mobil, entegrasyon) karşı
    // sağlamlaştırmak için: kaydetmeden önce Türkiye yerel takvim gününe normalize ediyoruz —
    // FacilityGroups.ApplicationStartDate'in her zaman 00:00:00 olarak saklanma deseniyle tutarlı.
    private static DateTime? NormalizeApplicationDate(DateTime? value)
    {
        if (value is not DateTime dt) return null;
        var turkeyLocal = dt.Kind switch
        {
            DateTimeKind.Utc => TurkeyTime.ToTurkey(dt),
            DateTimeKind.Unspecified => dt,
            _ => TurkeyTime.ToTurkey(dt.ToUniversalTime()),
        };
        return turkeyLocal.Date;
    }

    private static string RawOrEmpty(JsonElement el)
        => el.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "{}" : el.GetRawText();

    private async Task<PagedResult<EventDto>> MapPageAsync(PagedResult<Event> paged, CancellationToken ct)
    {
        var catIds = paged.Items.Select(e => e.CategoryId).Distinct().ToList();
        var facIds = paged.Items.Where(e => e.FacilityId.HasValue).Select(e => e.FacilityId!.Value).Distinct().ToList();
        var hallIds = paged.Items.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToList();

        var cats = catIds.Count == 0
            ? new Dictionary<Guid, EventCategory>()
            : (await uow.EventCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);
        var facs = facIds.Count == 0
            ? new Dictionary<Guid, ServiceFacility>()
            : (await uow.ServiceFacilities.FindAsync(f => facIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);
        var halls = hallIds.Count == 0
            ? new Dictionary<Guid, Hall>()
            : (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id);
        var counts = await uow.EventApplications.CountByEventsAsync(paged.Items.Select(e => e.Id).ToList(), ct);

        return new PagedResult<EventDto>
        {
            Items = paged.Items.Select(e => Map(
                e,
                cats.GetValueOrDefault(e.CategoryId)?.Name ?? "",
                cats.GetValueOrDefault(e.CategoryId)?.Color ?? "",
                e.FacilityId.HasValue ? facs.GetValueOrDefault(e.FacilityId.Value)?.Name : null,
                e.HallId.HasValue ? halls.GetValueOrDefault(e.HallId.Value)?.Name : null,
                counts.GetValueOrDefault(e.Id).Approved,
                counts.GetValueOrDefault(e.Id).Waitlist)).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private async Task<EventDto> ToDtoAsync(Event e, CancellationToken ct)
    {
        var cat = await uow.EventCategories.GetByIdAsync(e.CategoryId, ct);
        var facName = e.FacilityId.HasValue ? (await uow.ServiceFacilities.GetByIdAsync(e.FacilityId.Value, ct))?.Name : null;
        var hallName = e.HallId.HasValue ? (await uow.Halls.GetByIdAsync(e.HallId.Value, ct))?.Name : null;
        var counts = await uow.EventApplications.CountByEventsAsync([e.Id], ct);
        var c = counts.GetValueOrDefault(e.Id);
        return Map(e, cat?.Name ?? "", cat?.Color ?? "", facName, hallName, c.Approved, c.Waitlist);
    }

    private static EventDto Map(Event e, string categoryName, string categoryColor, string? facilityName, string? hallName, int registeredCount, int reserveCount)
    {
        var access = JsonSerializer.Deserialize<EventAccessConfigDto>(e.AccessJson, JsonOpts) ?? EmptyAccess();
        var location = string.IsNullOrWhiteSpace(e.LocationJson)
            ? null
            : JsonSerializer.Deserialize<EventLocationDto>(e.LocationJson, JsonOpts);

        return new EventDto(
            e.Id, e.Code, e.Name, e.CategoryId, categoryName, categoryColor,
            e.VenueType, e.FacilityId, facilityName, e.HallId, hallName, location,
            e.StartDate, e.EndDate, e.Gender, e.Capacity, e.ReserveCapacity, e.MinAge, e.MaxAge,
            e.ParticipationPeriod, e.ParticipationLimit, e.Description, e.InternalNote,
            ParseJson(FileUrl.NormalizeImagesJson(e.ImagesJson)), access, ParseJson(e.PricingJson), ParseJson(e.PointsJson),
            e.IsActive, e.SultangaziResidentOnly, e.StartTime, e.EndTime, registeredCount, reserveCount, e.SessionCount,
            e.CreatedAt, e.CreatedBy, e.UpdatedAt, e.UpdatedBy, e.DeletedAt, e.DeletedBy, e.ResidencyMode,
            e.ApplicationStartDate, e.ApplicationEndDate,
            string.IsNullOrWhiteSpace(e.ResponsibleJson) ? null : ParseJson(e.ResponsibleJson));
    }

    private static JsonElement ParseJson(string json)
        => JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json).RootElement.Clone();

    private static EventAccessConfigDto EmptyAccess()
        => new(false, false, "none", "required", true, "checkin", true, "rotating", 30, false, false, false, false, []);

    private static string MapAction(AuditAction a) => a switch
    {
        AuditAction.Create => "created",
        AuditAction.Update => "updated",
        AuditAction.SoftDelete or AuditAction.Delete => "deleted",
        AuditAction.Restore => "restored",
        AuditAction.StatusChange => "updated",
        _ => a.ToString().ToLowerInvariant(),
    };
}
