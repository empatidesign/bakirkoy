using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Nexora.Infrastructure.Storage;
using Nexora.Application.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.ParticipantEvents;
using Nexora.Application.Features.ParticipantEvents.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public partial class ParticipantEventService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IAuditService audit,
    IActivityLogger log,
    IEventAttendanceService attendance,
    Nexora.Application.Features.Events.IEventNotificationService notifications,
    Nexora.Application.Features.Notifications.INotificationService inApp,
    Nexora.Application.Features.Events.IEventApplicationService applications,
    Nexora.Application.Features.Events.IEventSettingsService eventSettings,
    IOptionsMonitor<ResidencySettings> residencySettings) : IParticipantEventService
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private string SultangaziDistrictCode => residencySettings.CurrentValue.SultangaziDistrictCode;

    public async Task<PagedResult<CitizenEventDto>> DiscoverAsync(CitizenDiscoverParams p, CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        var listParams = new EventListParams
        {
            Search = p.Search,
            CategoryId = p.CategoryId,
            IsActive = true,
            // Tarih filtresi VERİTABANINDA uygulanır; aşağıdaki bellek içi
            // kontroller yalnızca seans bazlı elemeyi yapar.
            StartDate = TurkeyTime.TodayStartUtc(), // UAT 2026-09-24: EndDate UTC; yerel today ile bugün biten kayıt listeden düşüyordu
            Sort = "startdate",
            Order = "asc",
        };

        // GetPagedAsync limiti 100'e sabitliyor (Repository.PaginateAsync);
        // burada tüm sonuç bellekte seanslara açılıp yeniden sayfalandığı
        // için sayfalamasız yol kullanılır.
        var candidates = await uow.Events.GetAllFilteredAsync(listParams, ct);

        var participant = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;
        var minor = participant is not null && Age(participant.BirthDate) < 18;
        var children = participant is not null
            ? await uow.Participants.GetChildrenAsync(participant.Id, ct)
            : [];

        var requireGenderMatch = (await eventSettings.GetAsync(ct)).Participation.RequireGenderMatch;

        var cats = await LoadCategoriesAsync(candidates.Select(e => e.CategoryId), ct);
        var venues = await LoadVenueNamesAsync(candidates, ct);
        var eventIds = candidates.Select(e => e.Id).ToList();
        var approved = await uow.EventApplications.CountByEventsAsync(eventIds, ct);
        var appliedEventIds = await AppliedEventIdsAsync(participant?.Id, eventIds, ct);
        var appliedSessionIds = await AppliedSessionIdsAsync(participant?.Id, eventIds, ct);

        var entries = new List<CitizenEventDto>();
        foreach (var e in candidates)
        {
            var (venueName, facilityName, venueLat, venueLng) = venues.GetValueOrDefault(e.Id, ("—", null, null, null));
            var cat = cats.GetValueOrDefault(e.CategoryId);
            var access = ReadAccess(e.AccessJson);

            if (!access.HasSessions)
            {
                // Kullanıcı bildirimi (2026-08-05): "etkinliğin günü geçmiş ve başvuruya kapalı
                // ise saati geçmiş ise göstermesin" — önceden sadece GÜN karşılaştırılıyordu
                // (e.EndDate.Date < today), saat hiç kontrol edilmiyordu. Sonuç: bugün sabah
                // 09:00'da biten bir etkinlik, günün ilerleyen saatlerinde (örn. 17:11) hâlâ
                // keşfet listesinde görünüyordu. ApplyAsync'teki aynı desenle (CombineDateAndTime,
                // satır ~264) tutarlı hale getirildi: gerçek bitiş zaman damgası (tarih+saat, UTC)
                // şimdiki zamanla karşılaştırılıyor. Ayrıca başvuru penceresi kapanmışsa
                // (ApplicationEndDate geçmişse) etkinlik listeden tamamen çıkarılıyor.
                if (CombineDateAndTime(e.EndDate, e.EndTime ?? "23:59") < DateTime.UtcNow) continue;
                if (EventApplicationWindow.Check(e.ApplicationStartDate, e.ApplicationEndDate, today) is not null
                    && e.ApplicationEndDate.HasValue && e.ApplicationEndDate.Value.Date < today) continue;
                var counts = approved.GetValueOrDefault(e.Id);
                entries.Add(ToCard(e, cat, venueName, facilityName, venueLat, venueLng,
                    e.Capacity, counts.Approved, e.ReserveCapacity, counts.Waitlist,
                    participant, appliedEventIds.Contains(e.Id), requireGenderMatch, children));
                continue;
            }

            var sessions = await uow.Sessions.GetByEventAsync(e.Id, ct);
            // Aynı düzeltme seans bazlı etkinlikler için: sadece s.Date.Date >= today yeterli
            // değildi, bugünkü ama saati geçmiş seanslar (örn. sabah 09:00 seansı, şu an 17:11
            // iken) hâlâ "yaklaşan" sayılıyordu. CombineDateAndTime ile gerçek bitiş zaman
            // damgası kontrol ediliyor.
            var upcoming = sessions.Where(s => s.IsActive && CombineDateAndTime(s.Date, s.EndTime ?? s.StartTime) >= DateTime.UtcNow).ToList();
            if (upcoming.Count == 0) continue;
            if (EventApplicationWindow.Check(e.ApplicationStartDate, e.ApplicationEndDate, today) is not null
                && e.ApplicationEndDate.HasValue && e.ApplicationEndDate.Value.Date < today) continue;

            var sessionApproved = await SessionApprovedCountsAsync(e.Id, ct);
            var sessionWaitlist = await SessionWaitlistCountsAsync(e.Id, ct);

            foreach (var s in upcoming.OrderBy(s => s.Date).ThenBy(s => s.StartTime))
            {
                var card = ToCard(e, cat, venueName, facilityName, venueLat, venueLng,
                    s.Capacity, sessionApproved.GetValueOrDefault(s.Id),
                    s.ReserveCapacity, sessionWaitlist.GetValueOrDefault(s.Id),
                    participant, appliedSessionIds.Contains(s.Id), requireGenderMatch, children);
                entries.Add(card with
                {
                    StartDate = s.Date,
                    EndDate = s.Date,
                    IsSingleDay = true,
                    SessionId = s.Id,
                    SessionStartTime = s.StartTime,
                    SessionEndTime = s.EndTime,
                });
            }
        }

        if (minor)
            entries = entries.Where(i => i.Eligible).ToList();

        // Seans kartları kendi gününe açıldıktan SONRA süzülür; çok günlü etkinlik
        // aralıkla kesişiyorsa listede kalır.
        if (p.DateFrom.HasValue)
            entries = entries.Where(i => i.EndDate.Date >= p.DateFrom.Value.Date).ToList();
        if (p.DateTo.HasValue)
            entries = entries.Where(i => i.StartDate.Date <= p.DateTo.Value.Date).ToList();
        // Girişsiz kullanıcıda EligibleForSelf hep false; süzülürse liste boşalır.
        if (p.OnlyEligible == true && participant is not null)
            entries = entries.Where(i => i.EligibleForSelf || i.AlreadyApplied).ToList();

        entries = [.. entries.OrderBy(i => i.AlreadyApplied ? 1 : 0).ThenBy(i => i.StartDate)];

        var total = entries.Count;
        var pageItems = entries.Skip((p.PageResolved - 1) * p.LimitResolved).Take(p.LimitResolved).ToList();

        return new PagedResult<CitizenEventDto>
        {
            Items = pageItems,
            Total = total,
            Page = p.PageResolved,
            Limit = p.LimitResolved,
        };
    }

    public async Task<CitizenEventDetailDto> GetDetailAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null || !ev.IsActive)
            throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var participant = currentUser.Id.HasValue
            ? await uow.Participants.GetByIdAsync(currentUser.Id.Value, ct)
            : null;
        var children = participant is not null
            ? await uow.Participants.GetChildrenAsync(participant.Id, ct)
            : [];

        var cat = await uow.EventCategories.GetByIdAsync(ev.CategoryId, ct);
        var (venueName, facilityName, venueLat, venueLng) = await ResolveVenueNameAsync(ev, ct);
        var approved = await uow.EventApplications.CountByEventsAsync([ev.Id], ct);
        var appliedEventIds = await AppliedEventIdsAsync(participant?.Id, [ev.Id], ct);

        var detailAccess = ReadAccess(ev.AccessJson);
        var sessions = (await uow.Sessions.GetByEventAsync(ev.Id, ct))
            .Where(s => s.IsActive && s.Date.Date >= TurkeyTime.TodayDate())
            .ToList();
        var headerCapacity = detailAccess.HasSessions ? sessions.Sum(s => s.Capacity) : ev.Capacity;
        var headerReserve = detailAccess.HasSessions ? sessions.Sum(s => s.ReserveCapacity) : ev.ReserveCapacity;

        var settings = await eventSettings.GetAsync(ct);
        var requireGenderMatch = settings.Participation.RequireGenderMatch;
        var allowWaitingList = settings.General.AllowWaitingList;

        var evCounts = approved.GetValueOrDefault(ev.Id);
        var card = ToCard(ev, cat, venueName, facilityName, venueLat, venueLng,
            headerCapacity, evCounts.Approved, headerReserve, evCounts.Waitlist,
            participant, appliedEventIds.Contains(ev.Id), requireGenderMatch, children);

        var sessionApproved = await SessionApprovedCountsAsync(ev.Id, ct);
        var sessionWaitlist = await SessionWaitlistCountsAsync(ev.Id, ct);
        var sessionPending = await SessionPendingCountsAsync(ev.Id, ct);
        var eventWaitlist = await uow.EventApplications.CountAsync(
            a => a.EventId == ev.Id && a.SessionId == null && a.Status == "waitlist", ct);
        var sessionDtos = sessions
            .OrderBy(s => s.Date).ThenBy(s => s.StartTime)
            .Select(s => new CitizenEventSessionDto(
                s.Id, s.Date, s.StartTime, s.EndTime,
                s.HallId.HasValue ? venueName : null,
                s.Capacity, sessionApproved.GetValueOrDefault(s.Id),
                s.ReserveCapacity, sessionWaitlist.GetValueOrDefault(s.Id),
                IsApplicationClosed(card.RegistrationMode, sessionApproved.GetValueOrDefault(s.Id),
                    sessionPending.GetValueOrDefault(s.Id), sessionWaitlist.GetValueOrDefault(s.Id),
                    s.Capacity, s.ReserveCapacity, allowWaitingList)))
            .ToList();

        var applicants = await BuildApplicantsAsync(ev, participant, requireGenderMatch, ct);
        var reservationType = string.IsNullOrWhiteSpace(detailAccess.ReservationType) ? "none" : detailAccess.ReservationType;
        var requiresSeat = detailAccess.HasSeating && ev.VenueType != "outdoor" && reservationType is "seat" or "row";

        return new CitizenEventDetailDto(
            card.Id, card.Code, card.Name, card.CategoryName, card.CategoryColor, card.VenueName, card.FacilityName, card.Latitude, card.Longitude,
            card.StartDate, card.EndDate, card.IsSingleDay, card.Gender, card.MinAge, card.MaxAge,
            card.Capacity, card.RegisteredCount, headerReserve, eventWaitlist, card.HasSessions, card.RegistrationMode,
            card.ImageUrl, card.DescriptionPreview, card.Eligible, card.AlreadyApplied,
            ev.Description, sessionDtos, applicants, requiresSeat, reservationType,
            ExtractPhotoUrls(ev.ImagesJson),
            detailAccess.AttendanceEnabled, detailAccess.QrEnabled, detailAccess.EntryMethod,
            detailAccess.CancellationDeadlineHours,
            ExtractRatioImages(ev.ImagesJson),
            ev.ApplicationStartDate, ev.ApplicationEndDate, card.ApplicationOpen,
            IsApplicationClosed(card.RegistrationMode, evCounts.Approved, evCounts.Pending, eventWaitlist,
                headerCapacity, headerReserve, allowWaitingList));
    }

    public async Task<CitizenApplicationDto> ApplyAsync(Guid eventId, CitizenApplyRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(ApplyAsync), new { eventId, req.SessionId });

        var actorId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participantId = req.ParticipantId ?? actorId;
        if (participantId != actorId)
        {
            var family = await uow.Participants.GetChildrenAsync(actorId, ct);
            if (family.All(c => c.Id != participantId))
                throw new ForbiddenException("Bu kişi adına başvuru yapma yetkiniz yok.", "APPLICANT_FORBIDDEN");
        }

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Başvuru yapılacak kişi bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.Status != ParticipantStatus.Active)
            throw new ConflictException("Seçilen kişinin hesabı aktif olmadığı için başvuru yapılamaz.", "ACCOUNT_NOT_ACTIVE");

        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null || !ev.IsActive)
            throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var settingsDto = await eventSettings.GetAsync(ct);
        var partSettings = settingsDto.Participation;
        var generalSettings = settingsDto.General;

        var eligibility = Violation(ev, participant, partSettings.RequireGenderMatch);
        if (eligibility is not null)
            throw new ConflictException(eligibility.Message, eligibility.ErrorCode);

        // Etkinliğin kendi StartDate/EndDate'inden BAĞIMSIZ, ayrı bir başvuru penceresi.
        // Null ise (eski/mevcut etkinlikler) davranış değişmez: başvuru her zaman açık kabul edilir.
        // FacilityApplicationWindow (Facility modülü) ile aynı desen: Nexora.Domain.Common.EventApplicationWindow.
        var windowBlock = EventApplicationWindow.Check(ev.ApplicationStartDate, ev.ApplicationEndDate, TurkeyTime.TodayDate());
        if (windowBlock is not null)
            throw new ConflictException(windowBlock.Value.Message, windowBlock.Value.Code);

        var access = ReadAccess(ev.AccessJson);

        Guid? sessionId = req.SessionId;
        Session? session = null;
        if (access.HasSessions)
        {
            if (!sessionId.HasValue)
                throw new ConflictException("Lütfen bir seans seçin.", "SESSION_REQUIRED");

            session = await uow.Sessions.GetByIdAsync(sessionId.Value, ct);
            if (session is null || session.EventId != ev.Id)
                throw new NotFoundException("Seçilen seans bulunamadı.", "SESSION_NOT_FOUND");

            if (!session.IsActive)
                throw new ConflictException("Bu seans şu anda başvuruya kapalıdır.", "SESSION_INACTIVE");

            // basvuruhitetmeyenkurallar.md (B-kovası, Etkinlik #14e1) canlı testte kanıtlandı:
            // geçmiş-seans kontrolü SADECE gün bazlıydı (Date < TodayDate()) — saat hiç
            // karşılaştırılmıyordu. Sonuç: bugün saat 00:01'de başlayan bir seans, günün ilerleyen
            // saatlerinde (örn. 01:52) hâlâ "geçmiş değil" sayılıp yeni başvuru kabul edebiliyordu.
            // Düzeltme: artık CombineDateAndTime ile gerçek başlangıç zaman damgası (tarih+saat, UTC)
            // DateTime.UtcNow ile karşılaştırılıyor — CancelAsync'teki aynı desenle tutarlı (satır ~413).
            if (CombineDateAndTime(session.Date, session.StartTime) < DateTime.UtcNow)
                throw new ConflictException("Geçmiş seansa başvurulamaz.", "SESSION_IN_PAST");
        }
        else
        {
            sessionId = null;
            if (CombineDateAndTime(ev.StartDate, ev.StartTime ?? "") < DateTime.UtcNow)
                throw new ConflictException("Geçmiş etkinliğe başvurulamaz.", "EVENT_IN_PAST");
        }

        if (partSettings.BlockDuplicateApplications
            && await HasActiveApplicationAsync(participantId, eventId, sessionId, access.HasSessions, ct))
            throw new ConflictException(
                access.HasSessions
                    ? $"{participant.FullName} bu seansa zaten başvurmuş."
                    : $"{participant.FullName} bu etkinliğe zaten başvurmuş.",
                "ALREADY_APPLIED");

        // enforceTcUnique: aynı TC kimlik numarasına sahip FARKLI bir katılımcı kaydının
        // (örn. mükerrer aile/çocuk profili) aynı etkinliğe/seansa zaten başvurmuş olması
        // engellenir. Önceden bu ayarın backend'de hiçbir karşılığı yoktu.
        if (partSettings.EnforceTcUnique && !string.IsNullOrWhiteSpace(participant.Tckn))
        {
            var sameTcActive = (await uow.EventApplications.FindAsync(
                a => a.EventId == eventId && a.ParticipantId != participantId && a.Status != "rejected" && a.Status != "cancelled"
                     && (!access.HasSessions || a.SessionId == sessionId), ct)).ToList();
            if (sameTcActive.Count > 0)
            {
                var otherIds = sameTcActive.Select(a => a.ParticipantId).Distinct().ToList();
                var others = await uow.Participants.FindAsync(p => otherIds.Contains(p.Id), ct);
                if (others.Any(p => p.Tckn == participant.Tckn))
                    throw new ConflictException(
                        "Bu TC Kimlik numarasıyla bu etkinliğe/seansa zaten başvuru yapılmış.",
                        "TC_ALREADY_APPLIED");
            }
        }

        var referenceDate = session?.Date ?? ev.StartDate;

        await uow.BeginTransactionAsync(ct);
        EventApplication application;
        string status;
        int? waitlistPosition;
        try
        {
            // K03: önce KİŞİ-kapsamlı kilit (etkinlik+katılımcı) — aynı kişinin aynı etkinliğin farklı
            // seanslarına eşzamanlı başvurusu katılım limiti için serialize olur; sonra kaynak (seans) kilidi.
            // Katılım limiti sayımı + kullanım yazımı artık aynı transaction + kilit içinde.
            await uow.AcquireAdvisoryLockAsync(EventParticipantLockKey(eventId, participantId), ct);
            await uow.AcquireAdvisoryLockAsync(EventScopeLockKey(eventId, sessionId), ct);

            await EnforceParticipationLimitAsync(ev, participantId, referenceDate, ct);

            var capacity = session?.Capacity ?? ev.Capacity;
            var reserveCapacity = session?.ReserveCapacity ?? ev.ReserveCapacity;
            status = access.RegistrationMode == "required" ? "pending" : "approved";
            waitlistPosition = null;
            if (capacity > 0)
            {
                var (approved, pending, waitlisted) = await uow.EventApplications.CountByScopeAsync(ev.Id, sessionId, ct);
                if (status == "approved")
                {
                    if (approved + pending >= capacity)
                    {
                        if (generalSettings.AllowWaitingList && reserveCapacity > 0 && waitlisted < reserveCapacity)
                        {
                            status = "waitlist";
                            waitlistPosition = waitlisted + 1;
                        }
                        else
                        {
                            throw new ConflictException("Etkinlik kontenjanı ve yedek listesi dolu.", "CAPACITY_FULL");
                        }
                    }
                }
                else if (approved >= capacity && pending + waitlisted >= reserveCapacity)
                {
                    throw new ConflictException("Etkinlik kontenjanı ve yedek listesi dolu.", "CAPACITY_FULL");
                }
            }

            var seat = status is "waitlist" ? null : await ResolveSeatAsync(ev, sessionId, req.SeatNumber, ct);

            var code = $"BSV-{await uow.EventApplications.NextCodeNumberAsync(ct):D6}";
            application = EventApplication.Create(
                ev.Id, sessionId, participantId, referenceDate,
                status, "none", "unpaid", code, currentUser.Name);
            if (seat is not null) application.AssignSeat(seat);

            await uow.EventApplications.AddAsync(application, ct);
            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        var (notifTitle, notifBody) = status switch
        {
            "approved" => ("Başvurunuz onaylandı", $"{ev.Name} etkinliğine başvurunuz onaylandı."),
            "waitlist" => ("Yedek listeye alındınız", $"{ev.Name} etkinliği kontenjanı dolu; yedek listesine {waitlistPosition}. sırada alındınız."),
            _ => ("Başvurunuz alındı", $"{ev.Name} etkinliğine başvurunuz alındı."),
        };

        await inApp.CreateAsync(participantId, notifTitle, notifBody, "application",
            "event", ev.Id.ToString(), ev.Name, null,
            status == "approved" ? "Onaylandı" : status == "waitlist" ? "Bekleme Listesi" : "İnceleniyor", ct);

        var statusEvent = status switch
        {
            "approved" => "application_registered",
            "waitlist" => "application_waitlisted",
            _ => "application_received",
        };
        await notifications.SendApplicationStatusAsync(
            statusEvent, participant, ev, session,
            null,
            waitlistPosition, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            Result = LogResult.Success,
            EntityType = "EventApplication",
            EntityId = application.Id,
            Module = "ParticipantEvents",
            Description = $"Vatandaş başvuru yaptı: {ev.Name} ({participant.FullName})",
            ActorUserId = actorId,
            ActorUserName = currentUser.Name,
        }, ct);

        var cat = await uow.EventCategories.GetByIdAsync(ev.CategoryId, ct);
        var (venueName, facilityName, venueLat, venueLng) = await ResolveVenueNameAsync(ev, ct);
        var appliedHallId = session?.HallId ?? ev.HallId;
        var appliedHall = appliedHallId.HasValue ? await uow.Halls.GetByIdAsync(appliedHallId.Value, ct) : null;
        return BuildApplicationDto(application, ev, cat, session, participant, venueName, facilityName, venueLat, venueLng, actorId, appliedHall);
    }

    private static long EventScopeLockKey(Guid eventId, Guid? sessionId)
    {
        var key = sessionId ?? eventId;
        return BitConverter.ToInt64(key.ToByteArray(), 0);
    }

    // K03: kişi-kapsamlı kilit — katılım limiti kapsamı ETKİNLİK bazlı olduğundan aynı kişinin aynı
    // etkinliğe (farklı seanslar dahil) eşzamanlı başvurusunu deterministik biçimde serialize eder.
    private static long EventParticipantLockKey(Guid eventId, Guid participantId)
        => BitConverter.ToInt64(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"event-participant:{eventId:N}:{participantId:N}")), 0);

    public async Task<PagedResult<CitizenApplicationDto>> GetApplicationsAsync(CitizenApplicationListParams p, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participantIds = new List<Guid> { participantId };
        if (string.Equals(p.Scope, "family", StringComparison.OrdinalIgnoreCase))
        {
            var children = await uow.Participants.GetChildrenAsync(participantId, ct);
            participantIds.AddRange(children.Select(c => c.Id));
        }

        participantIds = participantIds.Distinct().ToList();

        var paged = await uow.EventApplications.GetByParticipantsAsync(participantIds, p.Status, p.Period, p.PageResolved, p.LimitResolved, ct);
        var items = await MapManyAsync(paged.Items, participantId, ct);

        return new PagedResult<CitizenApplicationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task CancelApplicationAsync(Guid applicationId, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var application = await uow.EventApplications.GetByIdAsync(applicationId, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");

        var allowedIds = new List<Guid> { participantId };
        var children = await uow.Participants.GetChildrenAsync(participantId, ct);
        allowedIds.AddRange(children.Select(c => c.Id));

        if (!allowedIds.Contains(application.ParticipantId))
            throw new ForbiddenException("Bu başvuruya erişim yetkiniz yok.", "APPLICATION_FORBIDDEN");

        if (application.Status == "rejected")
            throw new ConflictException("Reddedilen kayıt iptal edilemez.", "NOT_CANCELABLE");

        // Bulgu (2026-10-04, canlı QA denetimi — nihai prod-öncesi tur, backend worker
        // "jaguar" tarafından bulundu, Travel'daki aynı sorunla eşleşiyor): zaten iptal
        // edilmiş bir başvuruyu tekrar iptal etme çağrısı hiçbir erken-çıkışa sahip
        // değildi — ikinci çağrı "approved" dalına düşüp tüm iptal/bildirim/waitlist-
        // terfi mantığını TEKRAR çalıştırıyordu (fonksiyonel olarak zararsız —
        // PromoteWaitlistAsync canlı DB sayımıyla (CountByScopeAsync) kapasiteyi yeniden
        // doğruluyor — ama vatandaşa 2. bir iptal bildirimi gidiyordu ve audit log'a aynı
        // olay 2. kez yazılıyordu). Artık idempotent: sessizce no-op olarak başarılı döner.
        if (application.Status == "cancelled")
            return;

        var startsAt = await ResolveApplicationStartAsync(application, ct);
        var cancelEvent = await uow.Events.GetByIdAsync(application.EventId, ct);
        var deadlineHours = cancelEvent is not null ? ReadAccess(cancelEvent.AccessJson).CancellationDeadlineHours : 0;
        var cancelDeadline = startsAt.AddHours(-deadlineHours);
        if (DateTime.UtcNow > cancelDeadline)
            throw new ConflictException(
                deadlineHours > 0
                    ? $"Bu etkinliğe en geç başlangıçtan {deadlineHours} saat önce iptal edebilirsiniz; iptal süresi doldu."
                    : "Başlamış veya geçmiş bir etkinlik için kayıt iptal edilemez.",
                "CANCEL_WINDOW_PASSED");

        var freedEventId = application.EventId;
        var freedSessionId = application.SessionId;
        var freedSeat = application.SeatNumber;

        if (application.Status == "pending")
        {
            // C6 düzeltmesi (2026-09-21): önceden burada uow.EventApplications.Delete()
            // çağrılıyordu, yani IsDeleted=true + Status="pending" kalıyordu. Global query
            // filter (!IsDeleted) yüzünden başvuru "Başvurularım" listesinden TAMAMEN
            // kayboluyordu (görünüşte hiç var olmamış gibi). SEDA modülündeki doğru
            // desenle tutarlı hale getirildi: soft-delete yerine sadece Status="cancelled"
            // set edilip kayıt geçmişte görünür bırakılıyor.
            application.SetStatus("cancelled");
            uow.EventApplications.Update(application);
            await uow.SaveChangesAsync(ct);

            await applications.PromoteWaitlistAsync(freedEventId, freedSessionId, freedSeat, ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Cancel,
                Result = LogResult.Success,
                EntityType = "EventApplication",
                EntityId = application.Id,
                Module = "ParticipantEvents",
                Description = "Vatandaş başvurusunu iptal etti",
                ActorUserId = participantId,
                ActorUserName = currentUser.Name,
            }, ct);
            return;
        }

        var ev = await uow.Events.GetByIdAsync(application.EventId, ct);
        var eventName = ev?.Name ?? "Etkinlik";

        await uow.BeginTransactionAsync(ct);
        try
        {
            application.AssignSeat(null);

            // C6 düzeltmesi: bkz. yukarıdaki "pending" dalındaki not — aynı sebep.
            application.SetStatus("cancelled");
            uow.EventApplications.Update(application);

            await uow.Notifications.AddAsync(Notification.Create(
                application.ParticipantId, "Kaydınız iptal edildi",
                $"{eventName} etkinliğindeki kaydınız iptal edildi.", "application",
                referenceType: "event",
                facilityName: eventName,
                statusInfo: "İptal Edildi"), ct);

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await applications.PromoteWaitlistAsync(freedEventId, freedSessionId, freedSeat, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Cancel,
            Result = LogResult.Success,
            EntityType = "EventApplication",
            EntityId = application.Id,
            Module = "ParticipantEvents",
            Description = $"Vatandaş onaylı kaydını iptal etti: {eventName}",
            ActorUserId = participantId,
            ActorUserName = currentUser.Name,
        }, ct);
    }

    public async Task<ActivityDto> CheckInAsync(Guid eventId, CitizenCheckInRequest req, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var method = string.IsNullOrWhiteSpace(req.QrCode) ? "Manuel" : "QR";

        var checkInReq = new CheckInRequest(
            QrCode: req.QrCode,
            EventId: eventId,
            SessionId: req.SessionId,
            ParticipantId: participantId,
            ParticipantName: participant.FullName,
            Tckn: participant.Tckn,
            Method: method,
            Kind: req.Kind,
            WalkIn: false,
            Latitude: req.Latitude,
            Longitude: req.Longitude
        );

        return await attendance.CheckInAsync(checkInReq, ct);
    }

    private async Task<DateTime> ResolveApplicationStartAsync(EventApplication application, CancellationToken ct)
    {
        if (application.SessionId.HasValue)
        {
            var session = await uow.Sessions.GetByIdAsync(application.SessionId.Value, ct);
            if (session is not null)
                return CombineDateAndTime(session.Date, session.StartTime);
        }

        var ev = await uow.Events.GetByIdAsync(application.EventId, ct);
        return ev is not null ? CombineDateAndTime(ev.StartDate, ev.StartTime) : application.ReferenceDate;
    }

    private static readonly TimeZoneInfo TurkeyTz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    private static DateTime CombineDateAndTime(DateTime date, string? time)
    {
        if (!string.IsNullOrWhiteSpace(time) && TimeSpan.TryParse(time, out var parsed))
        {
            var local = DateTime.SpecifyKind(date.Date.Add(parsed), DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(local, TurkeyTz);
        }
        return TurkeyTime.ToUtc(date.Date);
    }

    private async Task<bool> HasActiveApplicationAsync(Guid participantId, Guid eventId, Guid? sessionId, bool hasSessions, CancellationToken ct)
        => (await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.ParticipantId == participantId && a.Status != "rejected" && a.Status != "cancelled"
                 && (!hasSessions || a.SessionId == sessionId), ct)).Any();

    private async Task<HashSet<Guid>> AppliedEventIdsAsync(Guid? participantId, List<Guid> eventIds, CancellationToken ct)
    {
        if (participantId is null || eventIds.Count == 0) return [];

        var apps = await uow.EventApplications.FindAsync(
            a => eventIds.Contains(a.EventId) && a.ParticipantId == participantId.Value && a.Status != "rejected" && a.Status != "cancelled", ct);
        return apps.Select(a => a.EventId).ToHashSet();
    }

    private async Task<HashSet<Guid>> AppliedSessionIdsAsync(Guid? participantId, List<Guid> eventIds, CancellationToken ct)
    {
        if (participantId is null || eventIds.Count == 0) return [];

        var apps = await uow.EventApplications.FindAsync(
            a => eventIds.Contains(a.EventId) && a.ParticipantId == participantId.Value
                 && a.SessionId != null && a.Status != "rejected" && a.Status != "cancelled", ct);
        return apps.Where(a => a.SessionId.HasValue).Select(a => a.SessionId!.Value).ToHashSet();
    }

    private async Task<Dictionary<Guid, int>> SessionApprovedCountsAsync(Guid eventId, CancellationToken ct)
    {
        var apps = await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId != null && a.Status == "approved", ct);
        return apps
            .GroupBy(a => a.SessionId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private async Task<Dictionary<Guid, int>> SessionWaitlistCountsAsync(Guid eventId, CancellationToken ct)
    {
        var apps = await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId != null && a.Status == "waitlist", ct);
        return apps
            .GroupBy(a => a.SessionId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private async Task<Dictionary<Guid, int>> SessionPendingCountsAsync(Guid eventId, CancellationToken ct)
    {
        var apps = await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId != null && a.Status == "pending", ct);
        return apps
            .GroupBy(a => a.SessionId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private static bool IsApplicationClosed(string registrationMode, int approved, int pending, int waitlist, int capacity, int reserveCapacity, bool allowWaitingList)
    {
        if (capacity <= 0) return false;
        if (registrationMode == "required")
            return approved >= capacity && pending + waitlist >= reserveCapacity;
        var hasWaitRoom = allowWaitingList && reserveCapacity > 0 && waitlist < reserveCapacity;
        return approved + pending >= capacity && !hasWaitRoom;
    }

    private async Task EnforceParticipationLimitAsync(Event ev, Guid participantId, DateTime referenceDate, CancellationToken ct)
    {
        var (enforced, period, limit) = await ResolveParticipationLimitAsync(ev, ct);
        if (!enforced) return;

        var (start, end) = PeriodWindow(period, referenceDate);
        var count = await uow.EventApplications.CountActiveByParticipantInWindowAsync(ev.Id, participantId, start, end, null, ct);
        if (count >= limit)
            throw new ConflictException("Bu etkinlik için katılım sınırına ulaştınız.", "PARTICIPATION_LIMIT_REACHED");
    }

    // Etkinliğin kendi limiti boşsa etkinlik ayarlarındaki varsayılana düşülür (gezi tarafındaki
    // ResolveParticipationWindowAsync ile aynı desen) — bkz. EventParticipationLimitRules.
    private async Task<(bool Enforced, string Period, int Limit)> ResolveParticipationLimitAsync(Event ev, CancellationToken ct)
    {
        // Etkinliğin kendi ayarı yeterliyse sistem ayarlarına hiç gitmiyoruz.
        if (Nexora.Domain.Common.EventParticipationLimitRules.IsSelfSufficient(ev.ParticipationPeriod, ev.ParticipationLimit))
            return Nexora.Domain.Common.EventParticipationLimitRules.Resolve(
                ev.ParticipationPeriod, ev.ParticipationLimit, "none", 0);

        var defaults = (await eventSettings.GetAsync(ct))?.Participation;
        return Nexora.Domain.Common.EventParticipationLimitRules.Resolve(
            ev.ParticipationPeriod, ev.ParticipationLimit,
            defaults?.DefaultLimitPeriod ?? "none", defaults?.DefaultLimitCount ?? 0);
    }

    private async Task<Dictionary<Guid, EventCategory>> LoadCategoriesAsync(IEnumerable<Guid> categoryIds, CancellationToken ct)
    {
        var ids = categoryIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return (await uow.EventCategories.FindAsync(c => ids.Contains(c.Id), ct)).ToDictionary(c => c.Id);
    }

    private async Task<Dictionary<Guid, (string Venue, string? Facility, double? Latitude, double? Longitude)>> LoadVenueNamesAsync(List<Event> events, CancellationToken ct)
    {
        var hallIds = events.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value).Distinct().ToList();
        var facIds = events.Where(e => e.FacilityId.HasValue).Select(e => e.FacilityId!.Value).Distinct().ToList();

        var halls = hallIds.Count == 0
            ? new Dictionary<Guid, Hall>()
            : (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id);
        var allFacIds = facIds.Concat(halls.Values.Select(h => h.FacilityId)).Distinct().ToList();
        var facs = allFacIds.Count == 0
            ? new Dictionary<Guid, Nexora.Domain.Entities.ServiceFacilities.ServiceFacility>()
            : (await uow.ServiceFacilities.FindAsync(f => allFacIds.Contains(f.Id), ct)).ToDictionary(f => f.Id);

        var result = new Dictionary<Guid, (string Venue, string? Facility, double? Latitude, double? Longitude)>();
        foreach (var e in events)
        {
            var hall = e.HallId.HasValue ? halls.GetValueOrDefault(e.HallId.Value) : null;
            var fac = hall is not null
                ? facs.GetValueOrDefault(hall.FacilityId)
                : e.FacilityId.HasValue ? facs.GetValueOrDefault(e.FacilityId.Value) : null;
            var (jsonLat, jsonLng) = ReadLocationLatLng(e.LocationJson);
            result[e.Id] = (
                hall?.Name ?? fac?.Name ?? ReadLocationName(e.LocationJson) ?? "—",
                hall?.FacilityName ?? fac?.Name,
                fac?.Latitude ?? jsonLat,
                fac?.Longitude ?? jsonLng);
        }
        return result;
    }

    private async Task<(string Venue, string? Facility, double? Latitude, double? Longitude)> ResolveVenueNameAsync(Event ev, CancellationToken ct)
    {
        var hall = ev.HallId.HasValue ? (await uow.Halls.GetByIdAsync(ev.HallId.Value, ct)) : null;
        var fac = hall is not null
            ? await uow.ServiceFacilities.GetByIdAsync(hall.FacilityId, ct)
            : ev.FacilityId.HasValue ? await uow.ServiceFacilities.GetByIdAsync(ev.FacilityId.Value, ct) : null;
        var (jsonLat, jsonLng) = ReadLocationLatLng(ev.LocationJson);
        return (
            hall?.Name ?? fac?.Name ?? ReadLocationName(ev.LocationJson) ?? "—",
            hall?.FacilityName ?? fac?.Name,
            fac?.Latitude ?? jsonLat,
            fac?.Longitude ?? jsonLng);
    }

    private static string? ReadLocationName(string? locationJson)
    {
        if (string.IsNullOrWhiteSpace(locationJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(locationJson);
            if (doc.RootElement.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String)
            {
                var name = n.GetString();
                return string.IsNullOrWhiteSpace(name) ? null : name;
            }
        }
        catch { return null; }
        return null;
    }

    private static (double? Latitude, double? Longitude) ReadLocationLatLng(string? locationJson)
    {
        if (string.IsNullOrWhiteSpace(locationJson)) return (null, null);
        try
        {
            using var doc = JsonDocument.Parse(locationJson);
            double? lat = doc.RootElement.TryGetProperty("latitude", out var la) && la.ValueKind == JsonValueKind.Number ? la.GetDouble() : null;
            double? lng = doc.RootElement.TryGetProperty("longitude", out var lo) && lo.ValueKind == JsonValueKind.Number ? lo.GetDouble() : null;
            return (lat, lng);
        }
        catch { return (null, null); }
    }

    private CitizenEventDto ToCard(Event e, EventCategory? cat, string? venueName, string? facilityName, double? venueLat, double? venueLng, int capacity, int registeredCount, int reserveCapacity, int waitlistCount, Participant? participant, bool alreadyApplied, bool requireGenderMatch, IReadOnlyList<Participant>? children = null)
    {
        var access = ReadAccess(e.AccessJson);
        var eligibleForSelf = participant is not null && IsEligible(e, participant, requireGenderMatch);
        var eligibleForChildren = children is { Count: > 0 } && children.Any(c => IsEligible(e, c, requireGenderMatch));
        return new CitizenEventDto(
            e.Id, e.Code, e.Name,
            cat?.Name ?? "", cat?.Color ?? "",
            venueName ?? "—", facilityName, venueLat, venueLng,
            e.StartDate, e.EndDate, e.IsSingleDay, e.Gender, e.MinAge, e.MaxAge,
            capacity, registeredCount, reserveCapacity, waitlistCount,
            access.HasSessions, access.RegistrationMode,
            ExtractImageUrl(e.ImagesJson),
            ExtractPhotoUrls(e.ImagesJson),
            BuildPreview(e.Description),
            eligibleForSelf || eligibleForChildren,
            alreadyApplied,
            Images: ExtractRatioImages(e.ImagesJson),
            EligibleForSelf: eligibleForSelf,
            EligibleForChildren: eligibleForChildren,
            ApplicationOpen: EventApplicationWindow.Check(e.ApplicationStartDate, e.ApplicationEndDate, TurkeyTime.TodayDate()) is null);
    }

    private async Task<List<CitizenApplicationDto>> MapManyAsync(List<EventApplication> apps, Guid currentParticipantId, CancellationToken ct)
    {
        if (apps.Count == 0) return [];

        var eventIds = apps.Select(a => a.EventId).Distinct().ToList();
        var events = (await uow.Events.FindIncludingDeletedAsync(e => eventIds.Contains(e.Id), ct)).ToDictionary(e => e.Id);
        var catIds = events.Values.Select(e => e.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, EventCategory>()
            : (await uow.EventCategories.FindIncludingDeletedAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);
        var sessionIds = apps.Where(a => a.SessionId.HasValue).Select(a => a.SessionId!.Value).Distinct().ToList();
        var sessions = sessionIds.Count == 0
            ? new Dictionary<Guid, Session>()
            : (await uow.Sessions.FindAsync(s => sessionIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);
        var partIds = apps.Select(a => a.ParticipantId).Distinct().ToList();
        var parts = (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id);

        var venues = await LoadVenueNamesAsync(events.Values.ToList(), ct);

        var hallIds = events.Values.Where(e => e.HallId.HasValue).Select(e => e.HallId!.Value)
            .Concat(sessions.Values.Where(s => s.HallId.HasValue).Select(s => s.HallId!.Value))
            .Distinct().ToList();
        var halls = hallIds.Count == 0
            ? new Dictionary<Guid, Hall>()
            : (await uow.Halls.FindAsync(h => hallIds.Contains(h.Id), ct)).ToDictionary(h => h.Id);

        return apps.Select(a =>
        {
            var ev = events.GetValueOrDefault(a.EventId);
            var cat = ev is not null ? cats.GetValueOrDefault(ev.CategoryId) : null;
            var session = a.SessionId.HasValue ? sessions.GetValueOrDefault(a.SessionId.Value) : null;
            var part = parts.GetValueOrDefault(a.ParticipantId);
            var (venueName, facilityName, venueLat, venueLng) = ev is not null ? venues.GetValueOrDefault(ev.Id, ("—", null, null, null)) : ("—", null, null, null);
            var hallId = session?.HallId ?? ev?.HallId;
            var hall = hallId.HasValue ? halls.GetValueOrDefault(hallId.Value) : null;

            return BuildApplicationDto(a, ev, cat, session, part, venueName, facilityName, venueLat, venueLng, currentParticipantId, hall);
        }).ToList();
    }

    private static CitizenApplicationDto BuildApplicationDto(
        EventApplication a, Event? ev, EventCategory? cat, Session? session, Participant? part, string venueName, string? facilityName, double? venueLat, double? venueLng, Guid currentParticipantId, Hall? hall = null)
    {
        var sessionLabel = session is not null
            ? $"{session.Date:dd.MM.yyyy} · {session.StartTime}-{session.EndTime}"
            : null;
        var eventDate = session is not null
            ? CombineDateAndTime(session.Date, session.StartTime)
            : ev is not null && !string.IsNullOrWhiteSpace(ev.StartTime)
                ? CombineDateAndTime(ev.StartDate, ev.StartTime)
                : ev?.StartDate ?? a.ReferenceDate;
        var reservationType = ReadReservationTypeSafe(ev?.AccessJson);

        return new CitizenApplicationDto(
            a.Id, a.Code, a.EventId, ev?.Name ?? "",
            cat?.Name ?? "", cat?.Color ?? "",
            a.SessionId, sessionLabel, eventDate, venueName, facilityName, venueLat, venueLng,
            a.Status, a.ParticipantId, part?.FullName ?? "",
            a.ParticipantId == currentParticipantId, a.CreatedAt,
            HallSeatLabeler.Resolve(hall, a.SeatNumber), ev?.IsDeleted ?? false,
            ReservationType: reservationType,
            CancellationDeadlineHours: ev is not null ? ReadAccess(ev.AccessJson).CancellationDeadlineHours : 72,
            RejectionReason: a.RejectionReason);
    }

    private static string? ReadReservationTypeSafe(string? accessJson)
    {
        if (string.IsNullOrWhiteSpace(accessJson)) return null;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(accessJson);
            if (doc.RootElement.TryGetProperty("reservationType", out var rt) && rt.ValueKind == System.Text.Json.JsonValueKind.String)
            {
                var val = rt.GetString();
                return string.IsNullOrWhiteSpace(val) ? null : val;
            }
        }
        catch { }
        return null;
    }

    private bool IsEligible(Event ev, Participant participant, bool requireGenderMatch)
        => Violation(ev, participant, requireGenderMatch) is null;

    private Nexora.Domain.Common.EventEligibilityViolation? Violation(
        Event ev, Participant participant, bool requireGenderMatch)
        => Nexora.Domain.Common.EventEligibilityRules.CheckAllFull(
            ev, participant, null, TurkeyTime.TodayDate(),
            SultangaziDistrictCode, requireGenderMatch);

    private string? IneligibleReason(Event ev, Participant participant, bool requireGenderMatch)
        => Violation(ev, participant, requireGenderMatch)?.ShortReason;

    private async Task<List<CitizenEventApplicantDto>> BuildApplicantsAsync(Event ev, Participant? self, bool requireGenderMatch, CancellationToken ct)
    {
        if (self is null) return [];

        var people = new List<(Participant Person, bool IsSelf)> { (self, true) };
        var children = await uow.Participants.GetChildrenAsync(self.Id, ct);
        people.AddRange(children.Select(c => (c, false)));

        var ids = people.Select(x => x.Person.Id).ToList();
        var activeApps = await uow.EventApplications.FindAsync(
            a => a.EventId == ev.Id && ids.Contains(a.ParticipantId) && a.Status != "rejected" && a.Status != "cancelled", ct);
        var appliedIds = activeApps.Select(a => a.ParticipantId).ToHashSet();
        var activeCountByPerson = activeApps
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Count());
        var appliedSessionsByPerson = activeApps
            .Where(a => a.SessionId.HasValue)
            .GroupBy(a => a.ParticipantId)
            .ToDictionary(g => g.Key, g => g.Select(a => a.SessionId!.Value).ToList());

        var (limited, _, effectiveLimit) = await ResolveParticipationLimitAsync(ev, ct);

        return people.Select(x =>
        {
            var eligible = IsEligible(ev, x.Person, requireGenderMatch);
            var limitReached = limited && activeCountByPerson.GetValueOrDefault(x.Person.Id) >= effectiveLimit;
            return new CitizenEventApplicantDto(
                x.Person.Id, x.Person.FullName, x.IsSelf, Age(x.Person.BirthDate),
                x.Person.Gender.ToCode(),
                eligible, eligible ? null : IneligibleReason(ev, x.Person, requireGenderMatch),
                appliedIds.Contains(x.Person.Id),
                limitReached,
                appliedSessionsByPerson.GetValueOrDefault(x.Person.Id) ?? []);
        }).ToList();
    }

    private async Task<string?> ResolveSeatAsync(Event ev, Guid? sessionId, string? seatNumber, CancellationToken ct)
    {
        var access = ReadAccess(ev.AccessJson);
        var reservationType = string.IsNullOrWhiteSpace(access.ReservationType) ? "none" : access.ReservationType;
        if (!access.HasSeating || ev.VenueType == "outdoor" || reservationType == "none") return null;

        if (string.IsNullOrWhiteSpace(seatNumber))
            throw new ConflictException(
                reservationType == "row" ? "Bu etkinlik için sıra seçimi zorunludur." : "Bu etkinlik için koltuk seçimi zorunludur.",
                "SEAT_REQUIRED");

        var seat = seatNumber.Trim();
        if (reservationType == "seat" && await uow.EventApplications.IsSeatTakenAsync(ev.Id, sessionId, seat, null, ct))
            throw new ConflictException("Seçilen koltuk başka bir başvuru tarafından alınmış.", "SEAT_TAKEN");

        return seat;
    }

    public async Task<SeatMapDto> GetSeatMapAsync(Guid eventId, Guid? sessionId, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null || !ev.IsActive)
            throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var hallId = ev.HallId;
        if (sessionId.HasValue)
        {
            var session = await uow.Sessions.GetByIdAsync(sessionId.Value, ct);
            if (session?.HallId is not null) hallId = session.HallId;
        }

        Hall? hall = hallId.HasValue ? await uow.Halls.GetByIdAsync(hallId.Value, ct) : null;

        var states = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(hall?.SeatStatesJson))
        {
            // Mobil QA bulgusu (2026-09-22, madde 44): "koltuk seçimi kısmına geçmeden hata
            // oluştu bildirgesi çıkıyor". Bu iki Deserialize/Parse çağrısı korumasızdı —
            // salonun SeatStatesJson/LayoutJson alanı bozuk, boş nesne değil de bir dizi,
            // ya da beklenenden farklı şekilde kaydedilmişse JsonException sızıp uca kadar
            // gidiyor ve vatandaş ham bir 500 görüyordu. Koltuk planı verisi bozuksa doğru
            // davranış, rezervasyonu tamamen kilitlemek yerine boş bir plan dönmektir:
            // istemci "koltuk seçimi yok" akışına düşer, geri kalan akış çalışmaya devam eder.
            // (Aynı savunmacı desen: ReadAccess/ExtractRatioImages zaten try/catch kullanıyor.)
            try
            {
                var baseline = JsonSerializer.Deserialize<Dictionary<string, string>>(hall!.SeatStatesJson!, JsonOpts) ?? [];
                foreach (var kv in baseline)
                    if (kv.Value is "closed" or "protocol") states[kv.Key] = kv.Value;
            }
            catch (JsonException) { }
        }

        var occupied = await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId == sessionId && a.SeatNumber != null && a.Status != "rejected" && a.Status != "cancelled", ct);
        foreach (var a in occupied)
            if (a.SeatNumber is not null) states[a.SeatNumber] = "occupied";

        JsonElement? layout = null;
        if (!string.IsNullOrWhiteSpace(hall?.LayoutJson))
        {
            try { layout = JsonDocument.Parse(hall!.LayoutJson!).RootElement.Clone(); }
            catch (JsonException) { }
        }

        var access = ReadAccess(ev.AccessJson);
        var reservationType = string.IsNullOrWhiteSpace(access.ReservationType) ? "none" : access.ReservationType;
        return new SeatMapDto(hallId, hall?.Name, layout, states, reservationType);
    }

    private static int Age(DateTime birth)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birth.Year;
        if (birth.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    private static EventAccessConfigDto ReadAccess(string accessJson)
    {
        try
        {
            return JsonSerializer.Deserialize<EventAccessConfigDto>(accessJson, JsonOpts) ?? EmptyAccess();
        }
        catch
        {
            return EmptyAccess();
        }
    }

    private static EventAccessConfigDto EmptyAccess()
        => new(false, false, "none", "manual", true, "checkin", true, "rotating", 30, false, false, false, false, []);

    private static readonly string[] RatioKeys = ["16:9", "4:3", "1:1", "9:16"];

    private static Dictionary<string, string>? ExtractRatioImages(string imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(imagesJson);
            if (!doc.RootElement.TryGetProperty("ratios", out var ratiosEl) || ratiosEl.ValueKind != JsonValueKind.Object)
                return null;
            var result = new Dictionary<string, string>();
            foreach (var key in RatioKeys)
            {
                if (ratiosEl.TryGetProperty(key, out var variantEl)
                    && variantEl.ValueKind == JsonValueKind.Object
                    && variantEl.TryGetProperty("url", out var urlEl)
                    && urlEl.ValueKind == JsonValueKind.String)
                {
                    var url = FileUrl.Normalize(urlEl.GetString());
                    if (!string.IsNullOrWhiteSpace(url)) result[key] = url!;
                }
            }
            return result.Count > 0 ? result : null;
        }
        catch { return null; }
    }

    private static string? ExtractImageUrl(string imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return null;
        var ratios = ExtractRatioImages(imagesJson);
        if (ratios is not null)
            foreach (var key in RatioKeys)
                if (ratios.TryGetValue(key, out var ratioUrl)) return ratioUrl;
        try
        {
            using var doc = JsonDocument.Parse(imagesJson);
            var root = doc.RootElement;
            foreach (var group in new[] { "mobile", "web" })
            {
                if (!root.TryGetProperty(group, out var groupEl) || groupEl.ValueKind != JsonValueKind.Object)
                    continue;
                foreach (var variant in new[] { "card", "cover", "thumb" })
                {
                    if (groupEl.TryGetProperty(variant, out var variantEl)
                        && variantEl.ValueKind == JsonValueKind.Object
                        && variantEl.TryGetProperty("url", out var urlEl)
                        && urlEl.ValueKind == JsonValueKind.String)
                    {
                        var url = urlEl.GetString();
                        if (!string.IsNullOrWhiteSpace(url)) return FileUrl.Normalize(url);
                    }
                }
            }
        }
        catch
        {
            return null;
        }
        return null;
    }

    private static List<string>? ExtractPhotoUrls(string imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(imagesJson);
            if (!doc.RootElement.TryGetProperty("photos", out var photosEl) || photosEl.ValueKind != JsonValueKind.Array)
                return null;
            var urls = new List<string>();
            foreach (var p in photosEl.EnumerateArray())
            {
                if (p.TryGetProperty("url", out var urlEl) && urlEl.ValueKind == JsonValueKind.String)
                {
                    var url = urlEl.GetString();
                    var normalized = FileUrl.Normalize(url);
                    if (!string.IsNullOrWhiteSpace(normalized)) urls.Add(normalized);
                }
            }
            return urls.Count > 0 ? urls : null;
        }
        catch { return null; }
    }

    private static string BuildPreview(string description)
    {
        if (string.IsNullOrWhiteSpace(description)) return "";
        var text = HtmlTagRegex().Replace(description, " ");
        text = WhitespaceRegex().Replace(System.Net.WebUtility.HtmlDecode(text), " ").Trim();
        return text.Length <= 160 ? text : text[..160].TrimEnd() + "…";
    }

    private static (DateTime Start, DateTime End) PeriodWindow(string period, DateTime date)
    {
        // V09: etkinlik/seans tarihi UTC saklanır (TurkeyDateTimeConverter). Dönem sınırı Türkiye
        // takviminde kurulup sorgu için UTC'ye çevrilir — yıl/ay sınırında yanlış pencere önlenir.
        var d = TurkeyTime.ToTurkey(DateTime.SpecifyKind(date, DateTimeKind.Utc)).Date;
        var (start, end) = period switch
        {
            "daily" => (d, d.AddDays(1)),
            "weekly" => (StartOfWeek(d), StartOfWeek(d).AddDays(7)),
            "monthly" => (new DateTime(d.Year, d.Month, 1), new DateTime(d.Year, d.Month, 1).AddMonths(1)),
            "yearly" => (new DateTime(d.Year, 1, 1), new DateTime(d.Year + 1, 1, 1)),
            _ => (DateTime.MinValue, DateTime.MaxValue),
        };
        if (start == DateTime.MinValue) return (start, end);
        return (TurkeyTime.ToUtc(start), TurkeyTime.ToUtc(end));
    }

    private static DateTime StartOfWeek(DateTime d)
    {
        var diff = ((int)d.DayOfWeek + 6) % 7;
        return d.AddDays(-diff).Date;
    }

    [GeneratedRegex("<.*?>", RegexOptions.Singleline)]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
