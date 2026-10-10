using System.Text.Json;
using Microsoft.Extensions.Options;
using Nexora.Application.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class EventApplicationService(IUnitOfWork uow, ICurrentUser currentUser, IActivityLogger log, IExcelService excelService, Nexora.Application.Features.Events.IEventNotificationService notifications, Nexora.Application.Features.Notifications.INotificationService inApp, IOptionsMonitor<ResidencySettings> residencySettings, Nexora.Application.Common.Interfaces.IDashboardRealtimeNotifier dashboard, Nexora.Application.Features.Events.IEventSettingsService eventSettings, IUserScopeService userScope, IAuditService audit) : IEventApplicationService
{
    private string SultangaziDistrictCode => residencySettings.CurrentValue.SultangaziDistrictCode;

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);
    private static readonly string[] Statuses = ["pending", "approved", "rejected", "reviewing", "waitlist"];

    private async Task EnsureEventInScopeAsync(Guid eventId, CancellationToken ct)
    {
        if (currentUser.Id is not Guid uid) return;
        var scopedIds = await userScope.GetScopedRefIdsAsync(uid, "events", ct);
        if (scopedIds is not null && !scopedIds.Contains(eventId))
            throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");
    }

    public async Task<PagedResult<ApplicationDto>> GetPagedAsync(ApplicationListParams p, CancellationToken ct)
    {
        var scopedIds = currentUser.Id is Guid uid ? await userScope.GetScopedRefIdsAsync(uid, "events", ct) : null;
        var paged = await uow.EventApplications.GetPagedAsync(p, scopedIds, ct);
        return new PagedResult<ApplicationDto>
        {
            Items = await MapManyAsync(paged.Items, ct),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<ApplicationSummaryDto> GetSummaryAsync(Guid? eventId, Guid? sessionId, CancellationToken ct)
    {
        if (eventId.HasValue) await EnsureEventInScopeAsync(eventId.Value, ct);
        var (total, approved, pending, rejected, reviewing, waitlist) = await uow.EventApplications.GetSummaryAsync(eventId, sessionId, ct);
        return new ApplicationSummaryDto(total, approved, pending, rejected, reviewing, waitlist);
    }

    public async Task<ApplicationDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.EventApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureEventInScopeAsync(app.EventId, ct);
        return (await MapManyAsync([app], ct)).First();
    }

    public async Task<ApplicationDto> CreateAsync(ApplicationFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.EventId, req.ParticipantId });

        await EnsureEventInScopeAsync(req.EventId, ct);

        var ev = await uow.Events.GetByIdAsync(req.EventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        if (!ev.IsActive)
            throw new ConflictException("Bu etkinlik şu an başvuruya kapalıdır.", "EVENT_NOT_ACTIVE");

        var participant = await uow.Participants.GetByIdAsync(req.ParticipantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.Status != ParticipantStatus.Active)
            throw new ConflictException("Pasif veya engellenen katılımcı başvuru yapamaz.", "PARTICIPANT_NOT_ELIGIBLE");

        var settingsDto = await eventSettings.GetAsync(ct);
        var partSettings = settingsDto.Participation;

        EnsureEligible(ev, participant, partSettings.RequireGenderMatch);

        var sessionId = ParseGuid(req.SessionId);

        var hasSessions = ReadAccessFull(ev.AccessJson).HasSessions;
        var alreadyApplied = partSettings.BlockDuplicateApplications && (await uow.EventApplications.FindAsync(
            a => a.EventId == ev.Id && a.ParticipantId == req.ParticipantId && a.Status != "rejected"
                 && (!hasSessions || a.SessionId == sessionId), ct)).Any();
        if (alreadyApplied)
            throw new ConflictException(
                hasSessions ? "Bu katılımcı bu seansa zaten başvurmuş." : "Bu katılımcı bu etkinliğe zaten başvurmuş.",
                "ALREADY_APPLIED");

        if (partSettings.EnforceTcUnique && !string.IsNullOrWhiteSpace(participant.Tckn))
        {
            var sameTcActive = (await uow.EventApplications.FindAsync(
                a => a.EventId == ev.Id && a.ParticipantId != req.ParticipantId && a.Status != "rejected"
                     && (!hasSessions || a.SessionId == sessionId), ct)).ToList();
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

        var referenceDate = await ResolveReferenceDateAsync(ev, sessionId, ct);

        await EnforceLimitAsync(ev, req.ParticipantId, referenceDate, null, ct);

        // KİMLİK 2026-08-27 (kullanıcı isteği: cihaz altyapı testi sırasında canlı tespit edildi):
        // StartDate/Date UTC saklanır ama burada TurkeyTime.TodayDate() (yerel tarih) ile
        // dönüştürmeden doğrudan karşılaştırılıyordu. Türkiye saatiyle 00:00-03:00 arası
        // (UTC henüz bir önceki güne denk geldiği için) BUGÜN başlayan/bugünkü seanslar
        // yanlışlıkla "geçmiş" sayılıp reddediliyordu. EventService.CreateAsync'teki doğru
        // desenle (TurkeyTime.ToTurkey(...).Date) hizalandı — aynı desen RegistrationWindow
        // çifte UTC-offset düzeltmesinde (bkz. TravelApplicationService) de uygulanmıştı.
        var session = sessionId.HasValue ? await uow.Sessions.GetByIdAsync(sessionId.Value, ct) : null;
        if (session is not null)
        {
            if (TurkeyTime.ToTurkey(session.Date).Date < TurkeyTime.TodayDate())
                throw new ConflictException("Geçmiş seansa başvurulamaz.", "SESSION_IN_PAST");
        }
        else if (TurkeyTime.ToTurkey(ev.StartDate).Date < TurkeyTime.TodayDate())
            throw new ConflictException("Geçmiş etkinliğe başvurulamaz.", "EVENT_IN_PAST");
        var capacity = session?.Capacity ?? ev.Capacity;
        var reserveCapacity = session?.ReserveCapacity ?? ev.ReserveCapacity;

        await uow.BeginTransactionAsync(ct);
        EventApplication app;
        string status;
        int? waitlistPosition;
        (string Title, string Body, string StatusInfo) notificationPayload = default;
        try
        {
            await uow.AcquireAdvisoryLockAsync(ParticipantLockKey(req.ParticipantId), ct);
            await uow.AcquireAdvisoryLockAsync(EventScopeLockKey(ev.Id, sessionId), ct);
            await EnforceLimitAsync(ev, req.ParticipantId, referenceDate, null, ct);

            status = ReadRegistrationMode(ev.AccessJson) == "required" ? "pending" : "approved";
            waitlistPosition = null;
            if (status == "approved" && capacity > 0)
            {
                var (approved, pending, waitlisted) = await uow.EventApplications.CountByScopeAsync(ev.Id, sessionId, ct);
                if (approved + pending >= capacity)
                {
                    if (settingsDto.General.AllowWaitingList && reserveCapacity > 0 && waitlisted < reserveCapacity)
                    {
                        status = "waitlist";
                        waitlistPosition = waitlisted + 1;
                    }
                    else
                    {
                        status = "rejected";
                    }
                }
            }

            var seat = status is "waitlist" or "rejected" ? null : await ResolveSeatAsync(ev, sessionId, req.SeatNumber, null, ct);

            var code = $"BSV-{await uow.EventApplications.NextCodeNumberAsync(ct):D6}";
            app = EventApplication.Create(req.EventId, sessionId, req.ParticipantId, referenceDate,
                status, req.DocumentStatus, req.PaymentStatus, code, currentUser.Name);
            app.AssignSeat(seat);

            await uow.EventApplications.AddAsync(app, ct);

            var (notifTitle, notifBody) = status switch
            {
                "approved" => ("Başvurunuz onaylandı", $"{ev.Name} etkinliğine başvurunuz onaylandı."),
                "waitlist" => ("Yedek listeye alındınız", $"{ev.Name} etkinliği kontenjanı dolu; yedek listesine {waitlistPosition}. sırada alındınız."),
                "rejected" => ("Başvurunuz alınamadı", $"{ev.Name} etkinliği kontenjanı ve yedek listesi dolu olduğu için başvurunuz alınamadı."),
                _ => ("Başvurunuz alındı", $"{ev.Name} etkinliğine başvurunuz alındı."),
            };
            notificationPayload = (notifTitle, notifBody,
                status == "approved" ? "Onaylandı" : status == "waitlist" ? "Bekleme Listesi" : status == "rejected" ? "Reddedildi" : "İnceleniyor");

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        if (notificationPayload.Title is not null)
            await inApp.CreateAsync(req.ParticipantId, notificationPayload.Title, notificationPayload.Body,
                "application", "event", ev.Id.ToString(), ev.Name, null, notificationPayload.StatusInfo, ct);

        var statusEvent = status switch
        {
            "approved" => "application_registered",
            "waitlist" => "application_waitlisted",
            "rejected" => "application_rejected",
            _ => "application_received",
        };
        await notifications.SendApplicationStatusAsync(
            statusEvent, participant, ev, session,
            status == "rejected" ? "Kontenjan ve yedek listesi dolu." : null,
            waitlistPosition, ct);

        await dashboard.NotifyApplicationChangedAsync(new Nexora.Application.Common.Interfaces.DashboardApplicationEvent(
            "event", "created", app.Id, ev.Id, ev.Name, req.ParticipantId, participant?.FullName, status, DateTime.UtcNow), ct);

        return (await MapManyAsync([app], ct)).First();
    }

    private static long EventScopeLockKey(Guid eventId, Guid? sessionId)
    {
        var key = sessionId ?? eventId;
        return BitConverter.ToInt64(key.ToByteArray(), 0);
    }

    private static long ParticipantLockKey(Guid participantId) => BitConverter.ToInt64(participantId.ToByteArray(), 8);

    public async Task<ApplicationDto> UpdateAsync(Guid id, ApplicationFormRequest req, CancellationToken ct)
    {
        var app = await uow.EventApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureEventInScopeAsync(app.EventId, ct);

        var ev = await uow.Events.GetByIdAsync(req.EventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var sessionId = ParseGuid(req.SessionId);
        var referenceDate = await ResolveReferenceDateAsync(ev, sessionId, ct);

        await EnforceLimitAsync(ev, app.ParticipantId, referenceDate, app.Id, ct);

        var seat = await ResolveSeatAsync(ev, sessionId, req.SeatNumber, app.Id, ct);

        var previousStatus = app.Status;
        var statusChanged = !string.Equals(previousStatus, req.Status, StringComparison.Ordinal);

        if (statusChanged)
        {
            if (!Statuses.Contains(req.Status))
                throw new ConflictException("Geçersiz başvuru durumu.", "INVALID_APPLICATION_STATUS");

            if (previousStatus == "rejected" && req.Status == "approved")
                throw new ConflictException("Reddedilmiş bir başvuru doğrudan onaylanamaz.", "INVALID_STATUS_TRANSITION");
        }

        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(EventScopeLockKey(app.EventId, sessionId), ct);

            if (statusChanged && req.Status == "approved")
            {
                var targetSession = sessionId.HasValue ? await uow.Sessions.GetByIdAsync(sessionId.Value, ct) : null;
                var cap = targetSession?.Capacity ?? ev.Capacity;
                if (cap > 0)
                {
                    var (approved, _, _) = await uow.EventApplications.CountByScopeAsync(app.EventId, sessionId, ct);
                    if (approved >= cap)
                        throw new ConflictException("Kontenjan dolu. Onaylamak için kontenjanı artırın.", "CAPACITY_FULL");
                }
            }

            app.Update(sessionId, referenceDate, req.Status, req.DocumentStatus, req.PaymentStatus);
            app.AssignSeat(seat);
            uow.EventApplications.Update(app);
            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "EventApplication",
            EntityId = app.Id,
            Module = "Events",
            Description = $"Başvuru güncellendi: {app.Code}",
            OldValues = JsonSerializer.Serialize(new { Status = previousStatus }),
            NewValues = JsonSerializer.Serialize(new { app.Status, app.DocumentStatus, app.PaymentStatus, app.SeatNumber }),
        }, ct);

        if (statusChanged && previousStatus is "approved" or "pending" && req.Status == "rejected")
            await PromoteWaitlistAsync(app.EventId, sessionId, app.SeatNumber, ct);

        if (statusChanged && req.Status is "approved" or "waitlist")
            await CloseOverflowPendingAsync(app.EventId, sessionId, ct);

        return (await MapManyAsync([app], ct)).First();
    }

    public async Task<ApplicationDto> SetStatusAsync(Guid id, string status, string? reason, CancellationToken ct)
    {
        if (!Statuses.Contains(status))
            throw new ConflictException("Geçersiz başvuru durumu.", "INVALID_APPLICATION_STATUS");

        var app = await uow.EventApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureEventInScopeAsync(app.EventId, ct);

        var previousStatus = app.Status;
        var freedSeat = app.SeatNumber;

        if (previousStatus == "rejected" && status == "approved")
            throw new ConflictException("Reddedilmiş bir başvuru doğrudan onaylanamaz.", "INVALID_STATUS_TRANSITION");

        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(EventScopeLockKey(app.EventId, app.SessionId), ct);

            if (status == "approved" && previousStatus != "approved")
            {
                var target = await uow.Events.GetByIdAsync(app.EventId, ct);
                var targetSession = app.SessionId.HasValue ? await uow.Sessions.GetByIdAsync(app.SessionId.Value, ct) : null;
                var cap = targetSession?.Capacity ?? target?.Capacity ?? 0;
                if (cap > 0)
                {
                    var (approved, _, _) = await uow.EventApplications.CountByScopeAsync(app.EventId, app.SessionId, ct);
                    if (approved >= cap)
                        throw new ConflictException("Kontenjan dolu. Onaylamak için kontenjanı artırın.", "CAPACITY_FULL");
                }
            }

            // Bulgu (2026-09-27, canlı denetim): "waitlist" durumu "rejected" ile aynı şekilde
            // ele alınmıyordu — koltuklu bir başvuru admin tarafından yedek listeye alındığında
            // koltuk numarası üzerinde kalıyordu. Yedekteki bir kişi henüz kesin katılımcı
            // değildir (PromoteWaitlistAsync'in "boşalan koltuğu yedekteki kişiye ata" mantığıyla
            // da tutarlı olması için, yedekteyken koltuk sahibi olunamaz); bu da GetSeatMapAsync/
            // GetSeatPlanAsync'in o koltuğu "occupied" göstermesine ve gerçek onaylı bir
            // başvurunun o koltuğu hiç seçememesine yol açıyordu (fiili kapasite kilidi).
            if (status is "rejected" or "waitlist")
            {
                app.AssignSeat(null);
            }

            app.SetStatus(status, reason);
            uow.EventApplications.Update(app);

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "EventApplication",
            EntityId = app.Id,
            Module = "Events",
            Description = $"Başvuru durumu değiştirildi: {previousStatus} → {status} ({app.Code})",
            OldValues = JsonSerializer.Serialize(new { Status = previousStatus, SeatNumber = freedSeat }),
            NewValues = JsonSerializer.Serialize(new { Status = status, app.SeatNumber, app.RejectionReason }),
        }, ct);

        if (previousStatus != status && status is "approved" or "rejected" or "waitlist")
        {
            var ev = await uow.Events.GetByIdAsync(app.EventId, ct);
            var eventName = ev?.Name ?? "Etkinlik";
            var pos = status == "waitlist"
                ? await uow.EventApplications.GetWaitlistPositionAsync(app.EventId, app.SessionId, app.Id, ct)
                : 0;
            var (title, body, statusInfo) = status switch
            {
                "approved" => ("Başvurunuz onaylandı", $"{eventName} etkinliğine başvurunuz onaylandı.", "Onaylandı"),
                "waitlist" => ("Yedek listeye alındınız", $"{eventName} etkinliği için yedek listesine {pos}. sırada alındınız.", "Yedek Liste"),
                _ => ("Başvurunuz reddedildi", $"{eventName} etkinliğine başvurunuz reddedildi.{(app.RejectionReason is null ? "" : $" Gerekçe: {app.RejectionReason}")}", "Reddedildi"),
            };
            await inApp.CreateAsync(app.ParticipantId, title, body, "application",
                "event", app.EventId.ToString(), eventName, null, statusInfo, ct);
        }

        if (previousStatus != status && status is "approved" or "rejected" or "reviewing" or "waitlist")
        {
            var notifyEvent = await uow.Events.GetByIdAsync(app.EventId, ct);
            var participant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
            var session = app.SessionId.HasValue ? await uow.Sessions.GetByIdAsync(app.SessionId.Value, ct) : null;
            int? pos = status == "waitlist"
                ? await uow.EventApplications.GetWaitlistPositionAsync(app.EventId, app.SessionId, app.Id, ct)
                : null;
            var statusEvent = status switch
            {
                "approved" => "application_approved",
                "rejected" => "application_rejected",
                "waitlist" => "application_waitlisted",
                _ => "application_reviewing",
            };
            if (notifyEvent is not null && participant is not null)
                await notifications.SendApplicationStatusAsync(statusEvent, participant, notifyEvent, session, app.RejectionReason, pos, ct);
        }

        if (previousStatus is "approved" or "pending" && status == "rejected")
            await PromoteWaitlistAsync(app.EventId, app.SessionId, freedSeat, ct);

        if (previousStatus != status)
        {
            var evForRt = await uow.Events.GetByIdAsync(app.EventId, ct);
            await dashboard.NotifyApplicationChangedAsync(new Nexora.Application.Common.Interfaces.DashboardApplicationEvent(
                "event", status, app.Id, app.EventId, evForRt?.Name, app.ParticipantId, null, status, DateTime.UtcNow), ct);
        }

        if (previousStatus != status && status is "approved" or "waitlist")
            await CloseOverflowPendingAsync(app.EventId, app.SessionId, ct);

        return (await MapManyAsync([app], ct)).First();
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.EventApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Başvuru bulunamadı.", "APPLICATION_NOT_FOUND");
        await EnsureEventInScopeAsync(app.EventId, ct);

        var eventId = app.EventId;
        var sessionId = app.SessionId;
        var freedSeat = app.SeatNumber;
        var wasOccupying = app.Status is "approved" or "pending";

        uow.EventApplications.Delete(app);
        await uow.SaveChangesAsync(ct);

        if (wasOccupying)
            await PromoteWaitlistAsync(eventId, sessionId, freedSeat, ct);
    }

    public async Task PromoteWaitlistAsync(Guid eventId, Guid? sessionId, string? freedSeat, CancellationToken ct)
    {
        var autoApprove = (await eventSettings.GetAsync(ct)).General.AutoApproveWaitingList;
        if (!autoApprove) return;

        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null || ReadRegistrationMode(ev.AccessJson) == "required") return;

        var session = sessionId.HasValue ? await uow.Sessions.GetByIdAsync(sessionId.Value, ct) : null;
        var capacity = session?.Capacity ?? ev.Capacity;
        if (capacity <= 0) return;

        var (hasSeating, reservationType) = ReadSeating(ev.AccessJson);
        var seated = hasSeating && ev.VenueType != "outdoor" && reservationType != "none";

        var promoted = new List<EventApplication>();
        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(EventScopeLockKey(eventId, sessionId), ct);

            var (approved, pending, _) = await uow.EventApplications.CountByScopeAsync(eventId, sessionId, ct);
            var open = capacity - (approved + pending);
            if (open <= 0)
            {
                await uow.CommitAsync(ct);
                return;
            }

            var waitlist = await uow.EventApplications.GetWaitlistOrderedAsync(eventId, sessionId, ct);
            if (waitlist.Count == 0)
            {
                await uow.CommitAsync(ct);
                return;
            }

            foreach (var app in waitlist.Take(open))
            {
                if (seated)
                {
                    if (string.IsNullOrWhiteSpace(freedSeat)) break;
                    app.AssignSeat(freedSeat);
                    freedSeat = null;
                }
                app.SetStatus("approved");
                uow.EventApplications.Update(app);
                promoted.Add(app);
            }

            if (promoted.Count > 0) await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        if (promoted.Count == 0) return;

        foreach (var app in promoted)
        {
            await inApp.CreateAsync(app.ParticipantId, "Kaydınız onaylandı",
                $"{ev.Name} etkinliğinde yer açıldığı için yedek listesinden kaydınız onaylandı.", "application",
                "event", app.EventId.ToString(), ev.Name, null, "Onaylandı", ct);

            var participant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
            if (participant is not null)
                await notifications.SendApplicationStatusAsync("application_approved", participant, ev, session, null, null, ct);
        }
    }

    private async Task CloseOverflowPendingAsync(Guid eventId, Guid? sessionId, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(eventId, ct);
        if (ev is null) return;

        var session = sessionId.HasValue ? await uow.Sessions.GetByIdAsync(sessionId.Value, ct) : null;
        var capacity = session?.Capacity ?? ev.Capacity;
        var reserveCapacity = session?.ReserveCapacity ?? ev.ReserveCapacity;
        if (capacity <= 0) return;

        var closed = new List<EventApplication>();
        await uow.BeginTransactionAsync(ct);
        try
        {
            await uow.AcquireAdvisoryLockAsync(EventScopeLockKey(eventId, sessionId), ct);

            var (approved, _, waitlisted) = await uow.EventApplications.CountByScopeAsync(eventId, sessionId, ct);
            if (approved < capacity || waitlisted < reserveCapacity)
            {
                await uow.CommitAsync(ct);
                return;
            }

            var pendings = (await uow.EventApplications.FindAsync(
                a => a.EventId == eventId && a.SessionId == sessionId && a.Status == "pending", ct)).ToList();
            if (pendings.Count == 0)
            {
                await uow.CommitAsync(ct);
                return;
            }

            foreach (var app in pendings)
            {
                app.AssignSeat(null);
                app.SetStatus("rejected", "Kontenjan ve yedek listesi dolu.");
                uow.EventApplications.Update(app);
                closed.Add(app);
            }

            await uow.SaveChangesAsync(ct);
            await uow.CommitAsync(ct);
        }
        catch
        {
            await uow.RollbackAsync(ct);
            throw;
        }

        if (closed.Count == 0) return;

        foreach (var app in closed)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.StatusChange,
                EntityType = "EventApplication",
                EntityId = app.Id,
                Module = "Events",
                Description = $"Kontenjan ve yedek dolduğu için başvuru otomatik reddedildi: pending → rejected ({app.Code})",
                OldValues = JsonSerializer.Serialize(new { Status = "pending" }),
                NewValues = JsonSerializer.Serialize(new { Status = "rejected" }),
            }, ct);

            await inApp.CreateAsync(app.ParticipantId, "Başvurunuz alınamadı",
                $"{ev.Name} etkinliği kontenjanı ve yedek listesi dolduğu için başvurunuz alınamadı.", "application",
                "event", ev.Id.ToString(), ev.Name, null, "Reddedildi", ct);

            var participant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
            if (participant is not null)
                await notifications.SendApplicationStatusAsync("application_rejected", participant, ev, session,
                    "Kontenjan ve yedek listesi dolu.", null, ct);

            await dashboard.NotifyApplicationChangedAsync(new Nexora.Application.Common.Interfaces.DashboardApplicationEvent(
                "event", "rejected", app.Id, ev.Id, ev.Name, app.ParticipantId, null, "rejected", DateTime.UtcNow), ct);
        }
    }

    public async Task<SeatMapDto> GetSeatMapAsync(Guid eventId, Guid? sessionId, CancellationToken ct)
    {
        await EnsureEventInScopeAsync(eventId, ct);
        var ev = await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var hallId = ev.HallId;
        var occurrenceStatesJson = ev.SeatStatesJson;
        if (sessionId.HasValue)
        {
            var session = await uow.Sessions.GetByIdAsync(sessionId.Value, ct);
            if (session is not null)
            {
                if (session.HallId is not null) hallId = session.HallId;
                occurrenceStatesJson = session.SeatStatesJson;
            }
        }

        Hall? hall = hallId.HasValue ? await uow.Halls.GetByIdAsync(hallId.Value, ct) : null;

        var baselineJson = string.IsNullOrWhiteSpace(occurrenceStatesJson) ? hall?.SeatStatesJson : occurrenceStatesJson;

        var states = new Dictionary<string, string>();
        if (!string.IsNullOrWhiteSpace(baselineJson))
        {
            var baseline = JsonSerializer.Deserialize<Dictionary<string, string>>(baselineJson!, JsonOpts) ?? [];
            foreach (var kv in baseline)
                if (kv.Value is "closed" or "protocol") states[kv.Key] = kv.Value;
        }

        var occupied = await uow.EventApplications.FindAsync(
            a => a.EventId == eventId && a.SessionId == sessionId && a.SeatNumber != null && a.Status != "rejected", ct);
        foreach (var a in occupied)
            if (a.SeatNumber is not null) states[a.SeatNumber] = "occupied";

        JsonElement? layout = string.IsNullOrWhiteSpace(hall?.LayoutJson)
            ? null
            : JsonDocument.Parse(hall!.LayoutJson!).RootElement.Clone();

        var (_, reservationType) = ReadSeating(ev.AccessJson);
        return new SeatMapDto(hallId, hall?.Name, layout, states, reservationType);
    }

    private async Task<string?> ResolveSeatAsync(Event ev, Guid? sessionId, string? seatNumber, Guid? excludeId, CancellationToken ct)
    {
        var (hasSeating, reservationType) = ReadSeating(ev.AccessJson);
        if (!hasSeating || ev.VenueType == "outdoor" || reservationType == "none") return null;

        if (string.IsNullOrWhiteSpace(seatNumber))
            throw new ConflictException(
                reservationType == "row" ? "Bu etkinlik için sıra seçimi zorunludur." : "Bu etkinlik için koltuk seçimi zorunludur.",
                "SEAT_REQUIRED");

        var seat = seatNumber.Trim();
        if (reservationType == "seat" && await uow.EventApplications.IsSeatTakenAsync(ev.Id, sessionId, seat, excludeId, ct))
            throw new ConflictException("Seçilen koltuk başka bir başvuru tarafından alınmış.", "SEAT_TAKEN");

        return seat;
    }

    private static (bool HasSeating, string ReservationType) ReadSeating(string accessJson)
    {
        try
        {
            var access = JsonSerializer.Deserialize<EventAccessConfigDto>(accessJson, JsonOpts);
            return (access?.HasSeating ?? false, string.IsNullOrWhiteSpace(access?.ReservationType) ? "none" : access!.ReservationType);
        }
        catch
        {
            return (false, "none");
        }
    }

    private static string ReadRegistrationMode(string accessJson)
    {
        try
        {
            var access = JsonSerializer.Deserialize<EventAccessConfigDto>(accessJson, JsonOpts);
            return string.IsNullOrWhiteSpace(access?.RegistrationMode) ? "optional" : access!.RegistrationMode;
        }
        catch
        {
            return "optional";
        }
    }

    private void EnsureEligible(Event ev, Participant participant, bool requireGenderMatch = true)
    {
        var violation = Nexora.Domain.Common.EventEligibilityRules.CheckAllFull(
            ev, participant, null, TurkeyTime.TodayDate(),
            SultangaziDistrictCode, requireGenderMatch);

        if (violation is not null)
            throw new ConflictException(violation.Message, violation.ErrorCode);
    }

    // Vatandaş yolundaki ParticipantEventService.EnforceParticipationLimitAsync ile simetrik:
    // etkinliğin kendi limiti boşsa etkinlik ayarlarındaki varsayılana düşülür.
    private async Task EnforceLimitAsync(Event ev, Guid participantId, DateTime referenceDate, Guid? excludeId, CancellationToken ct)
    {
        var selfSufficient = Nexora.Domain.Common.EventParticipationLimitRules.IsSelfSufficient(
            ev.ParticipationPeriod, ev.ParticipationLimit);
        var defaults = selfSufficient ? null : (await eventSettings.GetAsync(ct))?.Participation;
        var (enforced, period, limit) = Nexora.Domain.Common.EventParticipationLimitRules.Resolve(
            ev.ParticipationPeriod, ev.ParticipationLimit,
            defaults?.DefaultLimitPeriod ?? "none", defaults?.DefaultLimitCount ?? 0);
        if (!enforced) return;

        var (start, end) = PeriodWindow(period, referenceDate);
        var count = await uow.EventApplications.CountActiveByParticipantInWindowAsync(ev.Id, participantId, start, end, excludeId, ct);
        if (count >= limit)
            throw new ConflictException($"Bu katılımcı için katılım sınırına ulaşıldı (en fazla {limit}).", "PARTICIPATION_LIMIT_REACHED");
    }

    private async Task<DateTime> ResolveReferenceDateAsync(Event ev, Guid? sessionId, CancellationToken ct)
    {
        if (sessionId.HasValue)
        {
            var session = await uow.Sessions.GetByIdAsync(sessionId.Value, ct);
            if (session is not null) return session.Date;
        }
        return ev.StartDate;
    }

    private async Task<List<ApplicationDto>> MapManyAsync(List<EventApplication> apps, CancellationToken ct)
    {
        if (apps.Count == 0) return [];

        var eventIds = apps.Select(a => a.EventId).Distinct().ToList();
        var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct)).ToDictionary(e => e.Id);
        var catIds = events.Values.Select(e => e.CategoryId).Distinct().ToList();
        var cats = catIds.Count == 0
            ? new Dictionary<Guid, EventCategory>()
            : (await uow.EventCategories.FindAsync(c => catIds.Contains(c.Id), ct)).ToDictionary(c => c.Id);
        var sessionIds = apps.Where(a => a.SessionId.HasValue).Select(a => a.SessionId!.Value).Distinct().ToList();
        var sessions = sessionIds.Count == 0
            ? new Dictionary<Guid, Session>()
            : (await uow.Sessions.FindAsync(s => sessionIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);
        var partIds = apps.Select(a => a.ParticipantId).Distinct().ToList();
        var parts = (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id);
        var missingPartIds = partIds.Where(x => !parts.ContainsKey(x)).ToList();
        if (missingPartIds.Count > 0)
            foreach (var deleted in await uow.Participants.FindIncludingDeletedAsync(p => missingPartIds.Contains(p.Id), ct))
                parts[deleted.Id] = deleted;

        return apps.Select(a =>
        {
            var ev = events.GetValueOrDefault(a.EventId);
            var cat = ev is not null ? cats.GetValueOrDefault(ev.CategoryId) : null;
            var session = a.SessionId.HasValue ? sessions.GetValueOrDefault(a.SessionId.Value) : null;
            var part = parts.GetValueOrDefault(a.ParticipantId);
            var sessionLabel = session is not null ? $"{session.Date:dd.MM.yyyy} · {session.StartTime}-{session.EndTime}" : null;

            return new ApplicationDto(
                a.Id, a.Code, a.EventId, ev?.Name ?? "", cat?.Name ?? "", cat?.Color ?? "",
                a.SessionId, sessionLabel, a.ReferenceDate, DayName(a.ReferenceDate),
                a.ParticipantId, ResolveParticipantName(part), part?.Tckn ?? "", part?.Gender.ToString() ?? "",
                part is not null ? CalcAge(part.BirthDate) : 0, part?.Phone, part?.Email,
                a.Status, a.DocumentStatus, a.PaymentStatus, a.SeatNumber, a.CreatedAt, a.AppliedBy, a.RejectionReason);
        }).ToList();
    }

    private static string ResolveParticipantName(Participant? participant)
    {
        if (participant is null) return "Kayıt bulunamadı";
        return participant.IsDeleted ? $"{participant.FullName} (Silinmiş katılımcı)" : participant.FullName;
    }

    private static Guid? ParseGuid(string? value) => Guid.TryParse(value, out var g) ? g : null;

    private static int CalcAge(DateTime birthDate)
    {
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    private static (DateTime Start, DateTime End) PeriodWindow(string period, DateTime date)
    {
        var d = date.Date;
        return period switch
        {
            "daily"   => (d, d.AddDays(1)),
            "weekly"  => (StartOfWeek(d), StartOfWeek(d).AddDays(7)),
            "monthly" => (new DateTime(d.Year, d.Month, 1), new DateTime(d.Year, d.Month, 1).AddMonths(1)),
            "yearly"  => (new DateTime(d.Year, 1, 1), new DateTime(d.Year + 1, 1, 1)),
            _         => (DateTime.MinValue, DateTime.MaxValue),
        };
    }

    private static DateTime StartOfWeek(DateTime d)
    {
        var diff = ((int)d.DayOfWeek + 6) % 7;
        return d.AddDays(-diff).Date;
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

    private static EventAccessConfigDto ReadAccessFull(string accessJson)
    {
        try
        {
            return JsonSerializer.Deserialize<EventAccessConfigDto>(accessJson, JsonOpts)
                ?? DefaultAccess();
        }
        catch { return DefaultAccess(); }
    }

    private static EventAccessConfigDto DefaultAccess() =>
        new(false, false, "none", "manual", true, "checkin", true, "rotating", 30, false, false, false, false, []);

    public async Task<(byte[] Content, string FileName)> ExportAsync(ApplicationListParams p, CancellationToken ct)
    {
        const int pageSize = 100;
        const int maxPages = 200;
        var all = new List<ApplicationDto>();
        for (var page = 1; page <= maxPages; page++)
        {
            var chunk = await GetPagedAsync(p with { Page = page.ToString(), Limit = pageSize.ToString() }, ct);
            all.AddRange(chunk.Items);
            if (chunk.Items.Count < pageSize || all.Count >= chunk.Total) break;
        }

        var paged = new PagedResult<ApplicationDto> { Items = all, Total = all.Count, Page = 1, Limit = all.Count };
        var first = paged.Items.FirstOrDefault();
        var eventName = first?.EventName ?? "Etkinlik";
        var title = p.EventId.HasValue ? eventName : "Tüm Başvurular";
        var sessionInfo = first?.SessionLabel ?? (first?.EventDate is { } sd ? sd.ToString("dd.MM.yyyy") : "");
        var bytes = excelService.BuildEventApplicationExport(paged.Items, title, sessionInfo);
        var safeName = string.Concat(eventName.Where(c => !Path.GetInvalidFileNameChars().Contains(c))).Trim();
        var datePart = first?.EventDate is { } ed ? $" - {ed:dd.MM.yyyy}" : "";
        return (bytes, $"{safeName}{datePart}.xlsx");
    }
}
