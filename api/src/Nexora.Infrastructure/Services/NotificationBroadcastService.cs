using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class NotificationBroadcastService(
    IUnitOfWork uow,
    INotificationService notifications,
    INotificationRealtimeNotifier realtime,
    INotificationDispatcher dispatcher,
    ISmsService sms,
    Nexora.Application.Features.NotificationPreferences.INotificationPreferenceService preferences,
    IActivityLogger log) : INotificationBroadcastService
{
    private static readonly BroadcastTargetTypeDto[] Targets =
    [
        new("facilityGroup",       "Tesis grubu (kayıtlılar)",   "Seçili tesis programlarına KAYITLI (onaylı) katılımcılar"),
        new("facilityApplication", "Tesis grubu (başvuranlar)",  "Seçili tesis programlarına BAŞVURAN katılımcılar (durum filtrelenebilir)"),
        new("facilityApplicationIds", "Seçili tesis başvuruları", "Doğrudan seçili başvuru kayıtlarına ait katılımcılar"),
        new("facilityIds",         "Seçili tesisler",             "Seçili tesislere KAYITLI (aktif) katılımcılar"),
        new("facilityRegistrationIds", "Seçili kayıtlar",         "Doğrudan seçili tesis kayıtlarına ait katılımcılar"),
        new("event",               "Etkinlik başvuranları",       "Seçili etkinliklere başvuran katılımcılar"),
        new("session",             "Etkinlik seansı",             "Seçili etkinlik seanslarına başvuran katılımcılar"),
        new("eventHall",           "Etkinlik salonu",             "Seçili salonlardaki tüm etkinliklere başvuran katılımcılar"),
        new("travel",              "Gezi katılımcıları",          "Seçili seferlere başvuran/rezerve eden katılımcılar"),
        new("travelRoute",         "Gezi (rota) katılımcıları",   "Seçili gezilerin (rota) TÜM seferlerine başvuran/rezerve eden katılımcılar"),
        new("library",             "Kütüphane (aktif oturum)",    "Seçili kütüphanelerde şu an aktif oturumu olan katılımcılar"),
        new("quiz",                "Bilgi Yarışması katılımcıları", "Seçili yarışmaya katılan kullanıcılar"),
        new("quizParticipation",   "Seçili yarışma sonuçları",     "Doğrudan seçili yarışma katılım kayıtlarına ait kullanıcılar"),
        new("survey",              "Anket katılımcıları",         "Seçili ankete yanıt veren katılımcılar"),
        new("giftRequest",         "Hediye talep edenler",        "Seçili hediye taleplerini oluşturan katılımcılar"),
        new("sedaApplication",     "SEDA başvuranları",           "Seçili SEDA başvurularını yapan katılımcılar"),
        new("participant",         "Seçili kişiler",              "Doğrudan katılımcı kimlik listesi"),
        new("allMembers",          "Tüm aktif üyeler",            "Sistemdeki tüm aktif katılımcılar (dikkat: geniş kitle)"),
    ];

    public BroadcastTargetOptionsDto GetTargetOptions() => new(Targets);

    public async Task<BroadcastResultDto> BroadcastAsync(BroadcastRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Message))
            throw new ConflictException("Gönderilecek mesaj boş olamaz.", "EMPTY_MESSAGE");
        if (!req.Sms && !req.Notify && !req.Push)
            throw new ConflictException("En az bir kanal seçin (SMS, bildirim veya push).", "NO_CHANNEL");

        var needsIds = req.Target is not "allMembers";
        if (needsIds && (req.Ids is null || req.Ids.Count == 0))
            throw new ConflictException("En az bir kayıt seçmelisiniz.", "NO_TARGET");

        var participantIds = await ResolveRecipientsAsync(req, ct);
        var uniqueIds = participantIds.Distinct().ToList();
        if (uniqueIds.Count == 0)
            return new BroadcastResultDto(0, 0, 0, 0);

        var participants = await uow.Participants.FindAsync(p => uniqueIds.Contains(p.Id), ct);
        var title = string.IsNullOrWhiteSpace(req.Title) ? "Bilgilendirme" : req.Title!.Trim();
        var category = Nexora.Application.Features.NotificationPreferences.NotificationCategoryMap.Resolve(req.Target);

        var notifs = 0;
        var pushSent = 0;
        var smsSent = 0;

        foreach (var p in participants)
        {
            var delivery = await preferences.GetDeliveryAsync(p.Id, category, ct);

            if (req.Notify)
            {
                await notifications.CreateAsync(p.Id, title, req.Message, "broadcast:" + req.Target, ct);
                if (delivery.InAppEnabled) notifs++;
                if (delivery.InAppEnabled && delivery.PushEnabled && !delivery.IsQuietNow) pushSent++;
            }
            else if (req.Push && delivery.PushEnabled && !delivery.IsQuietNow)
            {
                await realtime.NotifyCitizenAsync(p.Id, new CitizenNotificationPayload(
                    Guid.NewGuid(), title, req.Message, "broadcast", "broadcast", null, DateTime.UtcNow), ct);
                pushSent++;
            }

            if (req.Sms && delivery.SmsEnabled && !delivery.IsQuietNow && !string.IsNullOrWhiteSpace(p.Phone))
            {
                try { if (await dispatcher.SendSmsAsync(p.Phone!, req.Message, ct)) smsSent++; }
                catch (Exception ex) { log.LogStepResult("BroadcastSmsFailed", new { p.Id, ex.Message }); }
            }
        }

        log.LogStepResult("Broadcast", new { req.Target, uniqueIds.Count, notifs, smsSent, pushSent, smsMockMode = sms.IsMockMode });
        return new BroadcastResultDto(uniqueIds.Count, smsSent, notifs, pushSent, SmsMockMode: req.Sms && smsSent > 0 && sms.IsMockMode);
    }

    private async Task<IReadOnlyCollection<Guid>> ResolveRecipientsAsync(BroadcastRequest req, CancellationToken ct)
    {
        var ids = req.Ids ?? [];
        switch (req.Target)
        {
            case "event":
                return await uow.EventApplications.GetParticipantIdsByEventsAsync(ids, ct);

            case "session":
                return await uow.EventApplications.GetParticipantIdsBySessionsAsync(ids, ct);

            case "travel":
                return await uow.TravelApplications.GetParticipantIdsByTravelsAsync(ids, ct);

            case "travelRoute":
            {
                var travels = await uow.Travels.FindAsync(t => ids.Contains(t.RouteId), ct);
                var travelIds = travels.Select(t => t.Id).ToList();
                if (travelIds.Count == 0) return [];
                return await uow.TravelApplications.GetParticipantIdsByTravelsAsync(travelIds, ct);
            }

            case "facilityGroup":
                return await uow.FacilityRegistrations.GetParticipantIdsByGroupsAsync([.. ids], ct);

            case "facilityApplication":
            {
                var apps = await uow.FacilityApplications.FindAsync(
                    a => a.GroupId != null && ids.Contains(a.GroupId.Value) && a.ParticipantId != null, ct);
                var filtered = string.IsNullOrWhiteSpace(req.Status)
                    ? apps
                    : apps.Where(a => a.Status == req.Status).ToList();
                return filtered.Where(a => a.ParticipantId.HasValue).Select(a => a.ParticipantId!.Value).ToList();
            }

            case "facilityApplicationIds":
                return await uow.FacilityApplications.GetParticipantIdsByApplicationIdsAsync(ids, ct);

            case "facilityIds":
                return await uow.FacilityRegistrations.GetParticipantIdsByFacilitiesAsync([.. ids], ct);

            case "facilityRegistrationIds":
                return await uow.FacilityRegistrations.GetParticipantIdsByRegistrationIdsAsync([.. ids], ct);

            case "eventHall":
            {
                var events = await uow.Events.FindAsync(e => e.HallId != null && ids.Contains(e.HallId.Value) && e.IsActive, ct);
                var eventIds = events.Select(e => e.Id).ToList();
                if (eventIds.Count == 0) return [];
                return await uow.EventApplications.GetParticipantIdsByEventsAsync(eventIds, ct);
            }

            case "library":
            {
                var sessions = await uow.LibrarySessions.FindAsync(
                    s => ids.Contains(s.LibraryId) && s.ParticipantId != null
                      && LibrarySessionStatus.ActiveStatuses.Contains(s.Status), ct);
                return sessions.Where(s => s.ParticipantId.HasValue).Select(s => s.ParticipantId!.Value).ToList();
            }

            case "quiz":
            {
                var tckns = await uow.Quizzes.GetParticipantTcknsByQuizzesAsync(ids, ct);
                if (tckns.Count == 0) return [];
                var quizParticipants = await uow.Participants.FindAsync(p => tckns.Contains(p.Tckn), ct);
                return quizParticipants.Select(p => p.Id).ToList();
            }

            case "quizParticipation":
            {
                var tckns = await uow.Quizzes.GetParticipantTcknsByParticipationIdsAsync(ids, ct);
                if (tckns.Count == 0) return [];
                var quizParticipants = await uow.Participants.FindAsync(p => tckns.Contains(p.Tckn), ct);
                return quizParticipants.Select(p => p.Id).ToList();
            }

            case "survey":
                return await uow.Surveys.GetParticipantIdsBySurveysAsync(ids, ct);

            case "giftRequest":
                return await uow.GiftRequests.GetParticipantIdsByRequestsAsync(ids, ct);

            case "sedaApplication":
                return await uow.SedaApplications.GetCitizenUserIdsByApplicationsAsync(ids, ct);

            case "participant":
                return ids;

            case "allMembers":
            {
                var members = await uow.Participants.FindAsync(p => p.Status == ParticipantStatus.Active, ct);
                return members.Select(p => p.Id).ToList();
            }

            default:
                throw new ConflictException("Geçersiz hedef türü.", "INVALID_TARGET");
        }
    }
}
