using System.Text.Json;
using Nexora.Application.Common;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Enums;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Services;

public class SessionService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IActivityLogger log,
    IAuditService audit,
    IUserScopeService userScope,
    IParticipantNotificationService participantNotify,
    IScopedStaffService scopedStaff) : ISessionService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private static readonly Dictionary<string, DayOfWeek> DayKeyMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["monday"] = DayOfWeek.Monday,
        ["tuesday"] = DayOfWeek.Tuesday,
        ["wednesday"] = DayOfWeek.Wednesday,
        ["thursday"] = DayOfWeek.Thursday,
        ["friday"] = DayOfWeek.Friday,
        ["saturday"] = DayOfWeek.Saturday,
        ["sunday"] = DayOfWeek.Sunday,
    };

    public async Task<PagedResult<SessionDto>> GetPagedAsync(SessionListParams p, CancellationToken ct)
    {
        var scopedRefIds = currentUser.Id is Guid uid
            ? await userScope.GetScopedRefIdsAsync(uid, "sessions", ct)
            : null;
        var paged = await uow.Sessions.GetPagedAsync(p, scopedRefIds, ct);
        return new PagedResult<SessionDto>
        {
            Items = await MapManyAsync(paged.Items, ct),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<SessionSummaryDto> GetSummaryAsync(Guid? eventId, CancellationToken ct)
    {
        var (total, active, registered, capacity) = await uow.Sessions.GetSummaryAsync(eventId, ct);
        return new SessionSummaryDto(total, active, total - active, registered, capacity);
    }

    // Yetki alani (scope) kisitli bir kullanicinin, kendi liste ekraninda gormedigi
    // bir seansin ID'sini biliyorsa bile erismesini engeller (IDOR onlemi).
    private async Task EnsureInScopeAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "sessions", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(id))
            throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
    }

    public async Task<SessionDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var session = await uow.Sessions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);
        return (await MapManyAsync([session], ct)).First();
    }

    public async Task<List<SessionOptionDto>> GetOptionsByEventAsync(Guid eventId, CancellationToken ct)
    {
        var sessions = await uow.Sessions.GetByEventAsync(eventId, ct);
        return sessions
            .Where(s => s.IsActive)
            .Select(s => new SessionOptionDto(s.Id, $"{s.Date:dd.MM.yyyy} · {s.StartTime}-{s.EndTime}"))
            .ToList();
    }

    public async Task<SessionDto> CreateAsync(SessionFormRequest req, CancellationToken ct)
    {
        req = NormalizeDates(req);
        log.LogStep(nameof(CreateAsync), new { req.EventId });

        var ev = await uow.Events.GetByIdAsync(req.EventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        EnsureEventAcceptsSessions(ev);

        if (TurkeyTime.ToTurkey(req.Date).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş tarihli seans oluşturulamaz.", "PAST_DATE");

        await EnsureCapacityWithinHallAsync(req.HallId, req.Capacity, ct);

        var hours = await LoadHoursAsync(ev.FacilityId, ct);
        var slot = new SessionSlot(req.StartTime, req.EndTime);

        if (!WithinHours(hours, req.Date, slot))
            throw new ConflictException("Seans saati tesisin çalışma saatleri dışında.", "OUTSIDE_WORKING_HOURS");

        // Bulgu (NEXORA_ISLEVSEL_DOGRULUK_KONSOLIDE_2026-08-31, böl. 3.5 / P1-17, regresyon):
        // çakışma kontrolü ("SELECT sonra INSERT") ile INSERT arasında hiçbir kilit yoktu — 6
        // eşzamanlı POST /sessions isteği aynı salon+gün+üst üste binen saat aralığı için hepsi
        // "henüz çakışan yok" görüp devam edebiliyor, 3'ü başarıyla ekleniyordu (beklenen: 1).
        // Diğer modüllerde (EventApplicationService, TravelApplicationService, FacilityRegistrationService,
        // LibraryOperationsService, GiftRequestService, CompanyMeService/QrSystemService) kullanılan
        // pg_advisory_xact_lock (uow.AcquireAdvisoryLockAsync) deseniyle aynı şekilde: salon+gün bazlı
        // bir transaction-scoped advisory lock alınır, aynı anahtarla gelen eşzamanlı istekler bu satırda
        // sırayla bekler; çakışma kontrolü + INSERT tek bir istek için serileşir. Canlı test: 6 eşzamanlı
        // istek → yalnızca 1 tanesi 201, diğer 5'i 409 HALL_TIME_CONFLICT.
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        Session session;
        try
        {
            if (req.HallId.HasValue)
            {
                await uow.AcquireAdvisoryLockAsync(HallDateLockKey(req.HallId.Value, req.Date), ct);
                if ((await uow.Sessions.GetConflictingAsync(req.HallId.Value, req.Date, req.StartTime, req.EndTime, null, ct)).Count > 0)
                    throw new ConflictException("Salon bu tarih ve saatte başka bir seansa ayrılmış.", "HALL_TIME_CONFLICT");
            }

            var code = $"SES-{await uow.Sessions.NextCodeNumberAsync(ct):D6}";
            session = Session.Create(req.EventId, req.HallId, req.Date, req.StartTime, req.EndTime,
                req.Capacity, req.ReserveCapacity, req.Instructor, req.IsActive, code, currentUser.Name);
            session.SetResponsible(ParseGuid(req.InstructorId), req.InstructorPhone, req.InstructorEmail, req.EmergencyPhone);
            session.SetSeatStates(await HallSeatStatesAsync(req.HallId, ct));

            await uow.Sessions.AddAsync(session, ct);
            await uow.SaveChangesAsync(ct);
            await RecomputeEventSessionCountAsync(req.EventId, ct);
            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        await GrantInstructorAccessAsync(session, req, ev.Name, ct);

        return (await MapManyAsync([session], ct)).First();
    }

    public async Task<GenerateResultDto> GenerateAsync(SessionFormRequest req, CancellationToken ct)
    {
        req = NormalizeDates(req);
        log.LogStep(nameof(GenerateAsync), new { req.EventId });

        var ev = await uow.Events.GetByIdAsync(req.EventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        EnsureEventAcceptsSessions(ev);

        if (TurkeyTime.ToTurkey(req.StartDate).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş tarihli seans oluşturulamaz.", "PAST_DATE");

        await EnsureCapacityWithinHallAsync(req.HallId, req.Capacity, ct);

        var hours = await LoadHoursAsync(ev.FacilityId, ct);
        var hallSeats = await HallSeatStatesAsync(req.HallId, ct);
        var sessions = new List<Session>();
        var skipped = 0;

        foreach (var (date, slot) in BuildPairs(req))
        {
            if (!WithinHours(hours, date, slot)) { skipped++; continue; }
            if (req.HallId.HasValue && (await uow.Sessions.GetConflictingAsync(req.HallId.Value, date, slot.StartTime, slot.EndTime, null, ct)).Count > 0) { skipped++; continue; }

            var session = Session.Create(req.EventId, req.HallId, date, slot.StartTime, slot.EndTime,
                req.Capacity, req.ReserveCapacity, req.Instructor, req.IsActive, $"SES-{await uow.Sessions.NextCodeNumberAsync(ct):D6}", currentUser.Name);
            session.SetResponsible(ParseGuid(req.InstructorId), req.InstructorPhone, req.InstructorEmail, req.EmergencyPhone);
            session.SetSeatStates(hallSeats);
            sessions.Add(session);
        }

        if (sessions.Count > 0)
        {
            await uow.Sessions.AddRangeAsync(sessions, ct);
            await uow.SaveChangesAsync(ct);
            await RecomputeEventSessionCountAsync(req.EventId, ct);
            await uow.SaveChangesAsync(ct);
        }

        ev.SetSessionSchedule(JsonSerializer.Serialize(req));
        uow.Events.Update(ev);
        await uow.SaveChangesAsync(ct);

        return new GenerateResultDto(sessions.Count, skipped);
    }

    public async Task<int> RegenerateForRangeAsync(Guid eventId, DateTime fromDate, DateTime toDate, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null || string.IsNullOrWhiteSpace(ev.SessionScheduleJson)) return 0;

        var schedule = JsonSerializer.Deserialize<SessionFormRequest>(ev.SessionScheduleJson);
        if (schedule is null) return 0;

        var req = schedule with { Mode = "recurring", StartDate = fromDate, EndDate = toDate };
        var hours = await LoadHoursAsync(ev.FacilityId, ct);
        var hallSeats = await HallSeatStatesAsync(req.HallId, ct);
        var sessions = new List<Session>();

        foreach (var (date, slot) in BuildPairs(req))
        {
            // NOT: `date` burada BuildPairs'in ürettiği (req.Date/StartDate.Date'den türeyen,
            // zaten "gün" düzeyine indirgenmiş) bir değerdir — TurkeyTime.ToTurkey ile tekrar
            // dönüştürmek yanlış olur (BuildPairs'in kendisi ayrı bir incelemeyi gerektirir,
            // bu turun kapsamı dışında bırakıldı). Sadece doğrudan request alanlarından gelen
            // karşılaştırmalar (yukarıdaki iki blok) bu turda düzeltildi.
            if (date.Date < TurkeyTime.TodayDate()) continue;
            if (!WithinHours(hours, date, slot)) continue;
            if (req.HallId.HasValue && (await uow.Sessions.GetConflictingAsync(req.HallId.Value, date, slot.StartTime, slot.EndTime, null, ct)).Count > 0) continue;

            var session = Session.Create(req.EventId, req.HallId, date, slot.StartTime, slot.EndTime,
                req.Capacity, req.ReserveCapacity, req.Instructor, req.IsActive, $"SES-{await uow.Sessions.NextCodeNumberAsync(ct):D6}", currentUser.Name);
            session.SetResponsible(ParseGuid(req.InstructorId), req.InstructorPhone, req.InstructorEmail, req.EmergencyPhone);
            session.SetSeatStates(hallSeats);
            sessions.Add(session);
        }

        if (sessions.Count > 0)
        {
            await uow.Sessions.AddRangeAsync(sessions, ct);
            await uow.SaveChangesAsync(ct);
            await RecomputeEventSessionCountAsync(eventId, ct);
            await uow.SaveChangesAsync(ct);
        }

        return sessions.Count;
    }

    public async Task<List<SessionConflictDto>> CheckConflictsAsync(SessionFormRequest req, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(req.EventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var hours = await LoadHoursAsync(ev.FacilityId, ct);
        var hallName = req.HallId.HasValue ? (await uow.Halls.GetByIdAsync(req.HallId.Value, ct))?.Name : null;
        var result = new List<SessionConflictDto>();

        foreach (var (date, slot) in BuildPairs(req))
        {
            if (!WithinHours(hours, date, slot))
            {
                result.Add(new SessionConflictDto(date, DayName(date), slot.StartTime, slot.EndTime, "hours", hallName, null));
                continue;
            }

            if (req.HallId.HasValue)
            {
                var conflicts = await uow.Sessions.GetConflictingAsync(req.HallId.Value, date, slot.StartTime, slot.EndTime, null, ct);
                if (conflicts.Count > 0)
                {
                    var confEv = await uow.Events.GetByIdAsync(conflicts[0].EventId, ct);
                    result.Add(new SessionConflictDto(date, DayName(date), slot.StartTime, slot.EndTime, "hall", hallName, confEv?.Name));
                }
            }
        }

        return result;
    }

    public async Task<SessionDto> UpdateAsync(Guid id, SessionFormRequest req, CancellationToken ct)
    {
        req = NormalizeDates(req);
        var session = await uow.Sessions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        await EnsureCapacityWithinHallAsync(req.HallId, req.Capacity, ct);

        // CreateAsync'teki P1-17 düzeltmesiyle aynı TOCTOU riski burada da vardı (seans taşıma/saat
        // değiştirme sırasında eşzamanlı iki güncelleme aynı yeni saat aralığına çakışabilirdi) —
        // tutarlılık için aynı salon+gün advisory lock deseni uygulandı.
        var ownsTransaction = !uow.HasActiveTransaction;
        if (ownsTransaction) await uow.BeginTransactionAsync(ct);
        try
        {
            if (req.HallId.HasValue)
            {
                await uow.AcquireAdvisoryLockAsync(HallDateLockKey(req.HallId.Value, req.Date), ct);
                if ((await uow.Sessions.GetConflictingAsync(req.HallId.Value, req.Date, req.StartTime, req.EndTime, id, ct)).Count > 0)
                    throw new ConflictException("Salon bu tarih ve saatte başka bir seansa ayrılmış.", "HALL_TIME_CONFLICT");
            }

            session.Update(req.HallId, req.Date, req.StartTime, req.EndTime,
                req.Capacity, req.ReserveCapacity, req.Instructor, req.IsActive);
            session.SetResponsible(ParseGuid(req.InstructorId), req.InstructorPhone, req.InstructorEmail, req.EmergencyPhone);

            uow.Sessions.Update(session);
            await uow.SaveChangesAsync(ct);
            await RecomputeEventSessionCountAsync(session.EventId, ct);
            await uow.SaveChangesAsync(ct);
            if (ownsTransaction) await uow.CommitAsync(ct);
        }
        catch
        {
            if (ownsTransaction) await uow.RollbackAsync(ct);
            throw;
        }

        var ev = await uow.Events.GetByIdAsync(session.EventId, ct);
        await GrantInstructorAccessAsync(session, req, ev?.Name, ct);

        return (await MapManyAsync([session], ct)).First();
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var session = await uow.Sessions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        var eventId = session.EventId;
        var apps = (await uow.EventApplications.FindAsync(a => a.SessionId == id && a.Status != "cancelled", ct)).ToList();
        var pids = apps.Select(a => a.ParticipantId).Distinct().ToList();

        // Seans silinince bağlı başvurular (onaylı dahil) "approved" statüsünde askıda kalmamalı —
        // gerçek etkinlik/koltuk/kapasite artık yok, bu yüzden vatandaşın kendi iptal akışıyla
        // aynı şekilde (ParticipantEventService.CancelApplicationAsync) kayıtlar kaldırılır.
        // Önceden yalnızca bildirim gönderiliyor, başvuru kaydı "approved" statüsünde askıda
        // kalıyordu (yer kaplıyormuş gibi görünmeye devam ediyordu).
        // C6 düzeltmesi (2026-09-21): önceden DeleteRange (soft-delete/IsDeleted) kullanılıyordu,
        // bu da kaydı vatandaşın "Başvurularım" geçmişinden tamamen siliyordu (global query filter
        // !IsDeleted). Artık Status="cancelled" set edilip kayıt Update ile korunuyor.
        if (apps.Count > 0)
        {
            foreach (var app in apps)
                app.SetStatus("cancelled");
            uow.EventApplications.UpdateRange(apps);
        }

        uow.Sessions.Delete(session);
        await uow.SaveChangesAsync(ct);
        await RecomputeEventSessionCountAsync(eventId, ct);
        await uow.SaveChangesAsync(ct);

        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        await participantNotify.NotifyAsync(pids,
            $"{ev?.Name} etkinliğinin {session.Date:dd.MM.yyyy} tarihli seansı iptal edilmiştir.", ct);
    }

    public async Task<int> DeleteAfterDateAsync(Guid eventId, DateTime afterDate, CancellationToken ct)
    {
        var sessions = (await uow.Sessions.FindAsync(s => s.EventId == eventId && s.Date > afterDate.Date, ct)).ToList();
        if (sessions.Count == 0) return 0;

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var apps = (await uow.EventApplications.FindAsync(
                a => a.SessionId != null && sessionIds.Contains(a.SessionId.Value) && a.Status != "cancelled", ct)).ToList();
        var pids = apps.Select(a => a.ParticipantId).Distinct().ToList();

        // C6 düzeltmesi (2026-09-21): bkz. DeleteAsync'teki aynı not — soft-delete yerine
        // Status="cancelled" kullanılıyor, geçmişte görünürlük korunuyor.
        if (apps.Count > 0)
        {
            foreach (var app in apps)
                app.SetStatus("cancelled");
            uow.EventApplications.UpdateRange(apps);
        }

        uow.Sessions.DeleteRange(sessions);
        await uow.SaveChangesAsync(ct);
        await RecomputeEventSessionCountAsync(eventId, ct);
        await uow.SaveChangesAsync(ct);

        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        await participantNotify.NotifyAsync(pids,
            $"{ev?.Name} etkinliğinin {afterDate:dd.MM.yyyy} tarihinden sonraki seansları iptal edilmiştir.", ct);
        return sessions.Count;
    }

    public async Task<int> PropagateEventCapacityAsync(Guid eventId, int newCapacity, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var sessions = (await uow.Sessions.FindAsync(s => s.EventId == eventId && s.Date >= today && s.IsActive, ct)).ToList();
        if (sessions.Count == 0) return 0;

        var changed = 0;
        foreach (var session in sessions)
        {
            if (session.Capacity == newCapacity) continue;
            var approved = await uow.EventApplications.CountAsync(a => a.SessionId == session.Id && a.Status == "approved", ct);
            if (approved > newCapacity) continue;
            session.SetCapacity(newCapacity);
            uow.Sessions.Update(session);
            changed++;
        }

        if (changed > 0) await uow.SaveChangesAsync(ct);
        return changed;
    }

    public async Task<SessionDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var session = await uow.Sessions.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");
        await EnsureInScopeAsync(id, ct);

        if (session.IsActive) session.Deactivate();
        else session.Activate();

        uow.Sessions.Update(session);
        await uow.SaveChangesAsync(ct);
        await RecomputeEventSessionCountAsync(session.EventId, ct);
        await uow.SaveChangesAsync(ct);

        return (await MapManyAsync([session], ct)).First();
    }

    // Bir salon pasife alındığında bağlı gelecekteki aktif seansların hiçbir şekilde
    // etkilenmediği tespit edildi (bkz. salonlar-cascade-eksigi-2026-07-30 bulgusu, P1):
    // ne oturum/başvuru sonlandırılıyordu, ne pasif salona yeni seans eklenmesi
    // engelleniyordu, ne de vatandaşa gösterim duruyordu. Bu metod HallService.ToggleStatusAsync
    // tarafından, salon pasife alındığında çağrılır — bugünden itibaren (geçmişe dokunmadan)
    // bu salona bağlı hâlâ aktif olan tüm seansları pasife çeker; SaveSeatPlanAsync'teki
    // PropagateHallSeatChangeAsync deseniyle tutarlı bir "yayılım" (cascade) mekanizmasıdır.
    public async Task<int> DeactivateByHallAsync(Guid hallId, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var sessions = (await uow.Sessions.FindAsync(
            s => s.HallId == hallId && s.Date >= today && s.IsActive, ct)).ToList();
        if (sessions.Count == 0) return 0;

        foreach (var session in sessions)
        {
            session.Deactivate();
            uow.Sessions.Update(session);
        }
        await uow.SaveChangesAsync(ct);

        var eventIds = sessions.Select(s => s.EventId).Distinct().ToList();
        foreach (var eventId in eventIds)
            await RecomputeEventSessionCountAsync(eventId, ct);
        await uow.SaveChangesAsync(ct);

        return sessions.Count;
    }

    // Bulgu (UAT 2026-09-24): Seans.Date takvim günüdür (Unspecified, TR yerel). JSON
    // converter (TurkeyDateTimeConverter) saatsiz "2026-10-20" değerini TR gece yarısı
    // kabul edip UTC'ye çevirir (2026-10-19T21:00Z); ardından `.Date` alınınca seans BİR GÜN
    // ÖNCEYE kaydediliyordu (admin panel DatePicker tam olarak bu biçimi gönderir). Tüm giriş
    // noktalarında tarihler UTC'den TR takvim gününe geri çevrilir.
    private static SessionFormRequest NormalizeDates(SessionFormRequest req) => req with
    {
        Date = ToTurkeyDay(req.Date),
        StartDate = ToTurkeyDay(req.StartDate),
        EndDate = ToTurkeyDay(req.EndDate),
    };

    private static DateTime ToTurkeyDay(DateTime value)
        => value.Year < 2000 ? value
            : DateTime.SpecifyKind(TurkeyTime.ToTurkey(value).Date, DateTimeKind.Unspecified);

    // UAT 2026-09-24 bulgusu: toplu üretim sekanstan TEK değer alıp kodları yerelde artırıyordu
    // (nextCode++). Sekans yalnız 1 ilerlediği için sonraki create/generate aynı SES kodlarını
    // yeniden üretip IX_Sessions_Code ihlaliyle DUPLICATE_RECORD dönüyordu. Artık her seans
    // için sekanstan ayrı değer alınır (yukarıdaki iki döngü).
    private List<(DateTime Date, SessionSlot Slot)> BuildPairs(SessionFormRequest req)
    {
        var pairs = new List<(DateTime, SessionSlot)>();

        if (req.Mode != "recurring")
        {
            pairs.Add((req.Date.Date, new SessionSlot(req.StartTime, req.EndTime)));
            return pairs;
        }

        if (req.StartDate.Year < 2000 || req.EndDate.Year < 2000 || req.EndDate.Date < req.StartDate.Date)
            return pairs;

        var planByDay = (req.DayPlans ?? [])
            .Where(p => p is not null && DayKeyMap.ContainsKey(p.Day))
            .GroupBy(p => DayKeyMap[p.Day])
            .ToDictionary(g => g.Key, g => g.SelectMany(x => x.Slots ?? []).ToList());

        for (var date = req.StartDate.Date; date <= req.EndDate.Date; date = date.AddDays(1))
            if (planByDay.TryGetValue(date.DayOfWeek, out var slots))
                foreach (var slot in slots) pairs.Add((date, slot));

        return pairs;
    }

    private async Task EnsureCapacityWithinHallAsync(Guid? hallId, int capacity, CancellationToken ct)
    {
        if (!hallId.HasValue) return;
        var hall = await uow.Halls.GetByIdAsync(hallId.Value, ct);
        if (hall is null) return;
        // Pasif bir salona yeni seans eklenmesi önceden hiç engellenmiyordu (bkz.
        // salonlar-cascade-eksigi-2026-07-30 bulgusu, P1) — bu kontrol tüm create/generate/update
        // çağrı yollarının ortak noktası olduğu için tek bir yerde eklenmesi yeterli.
        if (!hall.IsActive)
            throw new ConflictException("Bu salon pasif durumda; yeni seans eklenemez.", "HALL_INACTIVE");
        var openSeats = SeatMath.OpenSeats(hall.Capacity, hall.SeatStatesJson);
        if (capacity > openSeats)
            throw new ConflictException($"Kontenjan salonun kullanılabilir koltuk sayısından ({openSeats}) büyük olamaz.", "CAPACITY_EXCEEDS_HALL");
    }

    private async Task GrantInstructorAccessAsync(Session session, SessionFormRequest req, string? eventName, CancellationToken ct)
    {
        if (!req.GrantAccess || (Guid.TryParse(req.InstructorId, out var iid) && iid != Guid.Empty))
            return;

        if (string.IsNullOrWhiteSpace(req.Instructor) || string.IsNullOrWhiteSpace(req.InstructorEmail))
            throw new ConflictException("Sisteme erişim verilecek eğitmenin adı ve e-postası zorunludur.", "STAFF_INFO_REQUIRED");

        var staff = await scopedStaff.AssignAsync(new AssignScopedStaffRequest(
            FullName: req.Instructor!,
            Tckn: req.Tckn,
            Phone: req.InstructorPhone,
            Email: req.InstructorEmail!,
            RoleTemplateKey: string.IsNullOrWhiteSpace(req.RoleTemplateKey) ? "egitmen" : req.RoleTemplateKey!,
            ScopeModuleKey: "sessions",
            ScopeRefId: session.Id,
            ScopeName: string.IsNullOrWhiteSpace(eventName) ? session.Code : eventName!,
            ScopeType: "Session",
            DeliveryChannel: string.IsNullOrWhiteSpace(req.DeliveryChannel) ? "Email" : req.DeliveryChannel!), ct);

        session.SetResponsible(staff.AdminUserId, req.InstructorPhone, staff.Email, req.EmergencyPhone);
        uow.Sessions.Update(session);
        await uow.SaveChangesAsync(ct);
    }

    private async Task<string?> HallSeatStatesAsync(Guid? hallId, CancellationToken ct)
        => hallId.HasValue ? (await uow.Halls.GetByIdAsync(hallId.Value, ct))?.SeatStatesJson : null;

    public async Task<Dictionary<string, string>> GetSeatPlanAsync(Guid sessionId, CancellationToken ct)
    {
        await EnsureInScopeAsync(sessionId, ct);
        var session = await uow.Sessions.GetByIdAsync(sessionId, ct)
            ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");

        var states = string.IsNullOrWhiteSpace(session.SeatStatesJson)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(session.SeatStatesJson) ?? [];

        var occupied = await uow.EventApplications.FindAsync(
            a => a.SessionId == sessionId && a.SeatNumber != null && a.Status != "rejected" && a.Status != "cancelled", ct);
        foreach (var a in occupied)
            if (a.SeatNumber is not null && !states.ContainsKey(a.SeatNumber))
                states[a.SeatNumber] = "reserved";

        return states;
    }

    public async Task SaveSeatPlanAsync(Guid sessionId, SeatPlanRequest req, CancellationToken ct)
    {
        await EnsureInScopeAsync(sessionId, ct);
        var session = await uow.Sessions.GetByIdAsync(sessionId, ct)
            ?? throw new NotFoundException("Seans bulunamadı.", "SESSION_NOT_FOUND");

        var hall = session.HallId.HasValue ? await uow.Halls.GetByIdAsync(session.HallId.Value, ct) : null;
        var prevSeatJson = session.SeatStatesJson;
        var holds = req.States
            .Where(kv => kv.Value is "protocol" or "closed")
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var apps = (await uow.EventApplications.FindAsync(
            a => a.SessionId == sessionId && a.Status == "approved" && a.SeatNumber != null, ct)).ToList();
        var relo = SeatReconciler.Relocate(holds, hall?.LayoutJson, apps);
        foreach (var app in relo.Touched) uow.EventApplications.Update(app);

        var seatJson = holds.Count == 0 ? null : JsonSerializer.Serialize(holds);
        session.SetSeatStates(seatJson);
        if (hall is not null)
        {
            var newOpen = SeatMath.OpenSeats(hall.Capacity, seatJson);
            var prevOpen = SeatMath.OpenSeats(hall.Capacity, prevSeatJson);
            if (session.Capacity == prevOpen) session.SetCapacity(newOpen);
            else if (session.Capacity > newOpen) session.SetCapacity(newOpen);

            var evt = await uow.Events.GetByIdAsync(session.EventId, ct);
            if (evt is not null)
            {
                if (evt.Capacity == prevOpen && evt.Capacity != newOpen) { evt.SetCapacity(newOpen); uow.Events.Update(evt); }
                else if (evt.Capacity > newOpen) { evt.SetCapacity(newOpen); uow.Events.Update(evt); }
            }
        }
        uow.Sessions.Update(session);
        await uow.SaveChangesAsync(ct);

        var seatContext = $"{(await uow.Events.GetByIdAsync(session.EventId, ct))?.Name ?? session.Code} ({session.Date:dd.MM.yyyy})";
        foreach (var move in relo.Moves)
        {
            log.LogStep("SeatRelocation", new { sessionId, move.ParticipantId, move.OldSeats, move.NewSeats, move.Manual });
            await audit.LogAsync(SeatReconciler.BuildMoveAudit(session.Code, "Session", session.Id, "Events", move), ct);
            await participantNotify.NotifySeatMoveAsync(move.ParticipantId, seatContext, move.OldSeats, move.NewSeats, move.Manual, ct);
        }
    }

    public async Task<HallSeatChangeImpactDto> PropagateHallSeatChangeAsync(Guid hallId, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(hallId, ct);
        if (hall is null) return new HallSeatChangeImpactDto(0, 0, 0, 0);

        var holds = JsonSerializer.Deserialize<Dictionary<string, string>>(hall.SeatStatesJson ?? "{}") ?? [];
        var today = TurkeyTime.TodayDate();

        int affected = 0, reassigned = 0, manualPending = 0, capacityReduced = 0;
        var moveAudits = new List<AuditEntry>();
        var moveNotices = new List<(SeatReconciler.Move Move, string Context)>();

        var sessions = (await uow.Sessions.FindAsync(s => s.HallId == hallId && s.Date >= today && s.IsActive, ct)).ToList();
        var sessionEventNames = (await uow.Events.FindAsync(e => sessions.Select(s => s.EventId).Distinct().Contains(e.Id), ct))
            .ToDictionary(e => e.Id, e => e.Name);
        foreach (var session in sessions)
        {
            var apps = (await uow.EventApplications.FindAsync(
                a => a.SessionId == session.Id && a.Status == "approved" && a.SeatNumber != null, ct)).ToList();
            var result = ApplyHolds(session.SeatStatesJson, holds, hall, session.Capacity, apps, session.Code, "Session", session.Id, moveAudits);
            var sessionContext = $"{sessionEventNames.GetValueOrDefault(session.EventId) ?? session.Code} ({session.Date:dd.MM.yyyy})";
            foreach (var move in result.Relo.Moves) moveNotices.Add((move, sessionContext));
            if (result.Changed)
            {
                session.SetSeatStates(result.NewJson);
                if (result.NewCapacity != session.Capacity) session.SetCapacity(result.NewCapacity);
                uow.Sessions.Update(session);
                affected++;
            }
            foreach (var app in result.Relo.Touched) uow.EventApplications.Update(app);
            reassigned += result.Relo.Reassigned;
            manualPending += result.Relo.ManualPending;
            capacityReduced += result.CapacityReduced;
        }

        var oneTimeEvents = (await uow.Events.FindAsync(e => e.HallId == hallId && e.StartDate >= today && e.IsActive, ct))
            .Where(IsSeatedOneTime).ToList();
        foreach (var ev in oneTimeEvents)
        {
            var apps = (await uow.EventApplications.FindAsync(
                a => a.EventId == ev.Id && a.SessionId == null && a.Status == "approved" && a.SeatNumber != null, ct)).ToList();
            var result = ApplyHolds(ev.SeatStatesJson ?? hall.SeatStatesJson, holds, hall, ev.Capacity, apps, ev.Code, "Event", ev.Id, moveAudits);
            var eventContext = $"{ev.Name} ({ev.StartDate:dd.MM.yyyy})";
            foreach (var move in result.Relo.Moves) moveNotices.Add((move, eventContext));
            if (result.Changed)
            {
                ev.SetSeatStates(result.NewJson);
                if (result.NewCapacity != ev.Capacity) ev.SetCapacity(result.NewCapacity);
                uow.Events.Update(ev);
                affected++;
            }
            foreach (var app in result.Relo.Touched) uow.EventApplications.Update(app);
            reassigned += result.Relo.Reassigned;
            manualPending += result.Relo.ManualPending;
            capacityReduced += result.CapacityReduced;
        }

        if (affected > 0) await uow.SaveChangesAsync(ct);

        foreach (var entry in moveAudits) await audit.LogAsync(entry, ct);
        foreach (var (move, context) in moveNotices)
            await participantNotify.NotifySeatMoveAsync(move.ParticipantId, context, move.OldSeats, move.NewSeats, move.Manual, ct);

        return new HallSeatChangeImpactDto(affected, reassigned, manualPending, capacityReduced);
    }

    private (bool Changed, string? NewJson, int NewCapacity, int CapacityReduced, SeatReconciler.Result Relo) ApplyHolds(
        string? currentStatesJson, Dictionary<string, string> holds, Hall hall, int currentCapacity,
        List<EventApplication> apps, string code, string entityType, Guid entityId, List<AuditEntry> moveAudits)
    {
        var states = JsonSerializer.Deserialize<Dictionary<string, string>>(currentStatesJson ?? "{}") ?? [];
        var changed = false;
        foreach (var (key, status) in holds)
            if (states.GetValueOrDefault(key) != status) { states[key] = status; changed = true; }

        var relo = SeatReconciler.Relocate(states, hall.LayoutJson, apps);
        foreach (var move in relo.Moves)
        {
            log.LogStep("SeatRelocation", new { entityId, move.ParticipantId, move.OldSeats, move.NewSeats, move.Manual });
            moveAudits.Add(SeatReconciler.BuildMoveAudit(code, entityType, entityId, "Events", move));
        }

        var newJson = states.Count == 0 ? null : JsonSerializer.Serialize(states);
        var openSeats = SeatMath.OpenSeats(hall.Capacity, newJson);
        var capacityReduced = 0;
        var newCapacity = currentCapacity;
        if (currentCapacity > openSeats) { capacityReduced = currentCapacity - openSeats; newCapacity = openSeats; changed = true; }
        if (relo.Touched.Count > 0) changed = true;

        return (changed, newJson, newCapacity, capacityReduced, relo);
    }

    private static bool IsSeatedOneTime(Event ev)
    {
        if (ev.VenueType == "outdoor" || !ev.HallId.HasValue) return false;
        try
        {
            var access = JsonSerializer.Deserialize<EventAccessConfigDto>(ev.AccessJson, JsonOpts);
            return access is not null && access.HasSeating && !access.HasSessions;
        }
        catch
        {
            return false;
        }
    }

    private async Task<(string WeekdayOpen, string WeekdayClose, string WeekendOpen, string WeekendClose)?> LoadHoursAsync(Guid? facilityId, CancellationToken ct)
    {
        if (!facilityId.HasValue) return null;
        var facility = await uow.ServiceFacilities.GetByIdAsync(facilityId.Value, ct);
        if (facility is null) return null;
        return (facility.WeekdayOpen, facility.WeekdayClose, facility.WeekendOpen, facility.WeekendClose);
    }

    private static bool WithinHours((string WeekdayOpen, string WeekdayClose, string WeekendOpen, string WeekendClose)? hours, DateTime date, SessionSlot slot)
    {
        if (hours is null) return true;

        var weekend = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
        var open = weekend ? hours.Value.WeekendOpen : hours.Value.WeekdayOpen;
        var close = weekend ? hours.Value.WeekendClose : hours.Value.WeekdayClose;

        if (string.IsNullOrWhiteSpace(open) || string.IsNullOrWhiteSpace(close)) return true;

        return string.CompareOrdinal(slot.StartTime, open) >= 0 && string.CompareOrdinal(slot.EndTime, close) <= 0;
    }

    private async Task RecomputeEventSessionCountAsync(Guid eventId, CancellationToken ct)
    {
        var count = await uow.Sessions.CountActiveByEventAsync(eventId, ct);
        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null) return;

        ev.SetSessionCount(count);
        if (ev.IsActive && count == 0 && HasSessions(ev.AccessJson))
            ev.Deactivate();
        else if (!ev.IsActive && count > 0 && HasSessions(ev.AccessJson))
            ev.Activate();

        uow.Events.Update(ev);
    }

    private static bool HasSessions(string accessJson)
    {
        try
        {
            var access = JsonSerializer.Deserialize<EventAccessConfigDto>(accessJson, JsonOpts);
            return access?.HasSessions ?? false;
        }
        catch
        {
            return false;
        }
    }

    private static void EnsureEventAcceptsSessions(Event ev)
    {
        if (!HasSessions(ev.AccessJson))
            throw new ConflictException("Bu etkinlik seanssız olarak ayarlandığı için seans eklenemez.", "EVENT_SESSIONLESS");
    }

    private async Task<List<SessionDto>> MapManyAsync(List<Session> sessions, CancellationToken ct)
    {
        if (sessions.Count == 0) return [];

        var eventIds = sessions.Select(s => s.EventId).Distinct().ToList();
        var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct)).ToDictionary(e => e.Id);
        var catIds = events.Values.Select(e => e.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, EventCategory>()
            : (await uow.EventCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);
        var hallIds = sessions.Where(s => s.HallId.HasValue).Select(s => s.HallId!.Value).Distinct().ToList();
        var halls = hallIds.Count == 0
            ? new Dictionary<Guid, Hall>()
            : (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id);
        var facilityIds = events.Values.Where(e => e.FacilityId.HasValue).Select(e => e.FacilityId!.Value).Distinct().ToList();
        var facilities = facilityIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await uow.ServiceFacilities.FindAsync(f => facilityIds.Contains(f.Id), ct)).ToDictionary(f => f.Id, f => f.Name);

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var sessionApps = await uow.EventApplications.FindAsync(
            a => a.SessionId != null && sessionIds.Contains(a.SessionId.Value) && a.Status != "rejected", ct);
        var registeredBySession = sessionApps.Where(a => a.Status != "waitlist")
            .GroupBy(a => a.SessionId!.Value).ToDictionary(g => g.Key, g => g.Count());
        var reserveBySession = sessionApps.Where(a => a.Status == "waitlist")
            .GroupBy(a => a.SessionId!.Value).ToDictionary(g => g.Key, g => g.Count());

        return sessions.Select(s =>
        {
            var ev = events.GetValueOrDefault(s.EventId);
            var cat = ev is not null ? cats.GetValueOrDefault(ev.CategoryId) : null;
            var hallName = s.HallId.HasValue ? halls.GetValueOrDefault(s.HallId.Value)?.Name : null;
            var facilityName = ev?.FacilityId is Guid fid ? facilities.GetValueOrDefault(fid) : null;
            return new SessionDto(
                s.Id, s.Code, s.EventId, ev?.Name ?? "", cat?.Name ?? "", cat?.Color ?? "",
                s.HallId, hallName, ev?.FacilityId, facilityName, s.Date, DayName(s.Date), s.StartTime, s.EndTime,
                s.Capacity, s.ReserveCapacity, registeredBySession.GetValueOrDefault(s.Id), reserveBySession.GetValueOrDefault(s.Id), s.IsActive, s.Instructor,
                s.InstructorId, s.InstructorPhone, s.InstructorEmail, s.EmergencyPhone, s.CreatedBy);
        }).ToList();
    }

    private static Guid? ParseGuid(string? value) => Guid.TryParse(value, out var g) ? g : null;

    // Salon+gün bazlı transaction-scoped advisory lock anahtarı. Aynı salonda aynı günde
    // (farklı saat aralıklarında bile) eşzamanlı seans oluşturma isteklerini serileştirir —
    // TOCTOU çakışma kontrolünü kapatmak için tarih (gün çözünürlüğünde) anahtara dahildir,
    // saat aralığına dahil DEĞİLDİR: aksi halde üst üste binen ama farklı dakikada başlayan
    // istekler farklı kilit anahtarı alıp yine paralel geçebilirdi (bkz. P1-17 canlı testi).
    private static long HallDateLockKey(Guid hallId, DateTime date)
    {
        var combined = $"hall-session:{hallId}:{date:yyyy-MM-dd}";
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(combined));
        return BitConverter.ToInt64(hash, 0);
    }

    private static string DayName(DateTime d) => d.DayOfWeek switch
    {
        DayOfWeek.Monday => "Pazartesi",
        DayOfWeek.Tuesday => "Salı",
        DayOfWeek.Wednesday => "Çarşamba",
        DayOfWeek.Thursday => "Perşembe",
        DayOfWeek.Friday => "Cuma",
        DayOfWeek.Saturday => "Cumartesi",
        _ => "Pazar",
    };
}
