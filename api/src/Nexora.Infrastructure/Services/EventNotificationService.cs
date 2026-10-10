using System.Globalization;
using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Services;

public class EventNotificationService(
    IEventSettingsService settings,
    INotificationDispatcher dispatcher,
    Nexora.Application.Features.Notifications.INotificationService inApp,
    IActivityLogger log) : IEventNotificationService
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private sealed record AccessTemplates(IReadOnlyList<EventNotificationTemplateDto>? NotificationTemplates);

    private static EventNotificationTemplateDto? ResolvePerEvent(string? accessJson, string statusEvent)
    {
        if (string.IsNullOrWhiteSpace(accessJson)) return null;
        try
        {
            var parsed = JsonSerializer.Deserialize<AccessTemplates>(accessJson, JsonOpts);
            var found = parsed?.NotificationTemplates?.FirstOrDefault(t => t.Event == statusEvent);
            // Bkz. EventSettingsService.GetAsync'teki aynı geriye-dönük-uyum notu: push alanları
            // eklenmeden önce kaydedilmiş etkinlik-özel şablonlarda NotifyBody boş gelir.
            return found is not null && string.IsNullOrWhiteSpace(found.NotifyBody)
                ? found with { NotifyBody = found.SmsBody }
                : found;
        }
        catch
        {
            return null;
        }
    }

    public async Task SendApplicationStatusAsync(
        string statusEvent,
        Participant participant,
        Event ev,
        Session? session,
        string? reason,
        int? waitlistPosition = null,
        CancellationToken ct = default)
    {
        var cfg = await settings.GetAsync(ct);

        // Global "Bildirimler" ayarlarındaki durum bazlı toggle'lar: kapalıysa ilgili
        // durum değişikliği için SMS/push hiç gönderilmez (önceden bu ayarlar backend'de
        // hiç okunmuyordu, tüm bildirimler ayardan bağımsız gönderiliyordu).
        var eventEnabled = statusEvent switch
        {
            "application_received" or "application_reviewing" => cfg.Notifications.ApplicationConfirm,
            "application_approved" or "application_registered" or "application_waitlisted" => cfg.Notifications.ApplicationConfirm,
            "application_rejected" => cfg.Notifications.CancellationNotice,
            _ => true,
        };
        if (!eventEnabled) return;

        // Kullanıcı isteği (2026-10-06): önceden push/SMS için TEK ortak gövde (SmsBody) kullanılıyordu
        // ve push kararı TEK global cfg.Notifications.Push anahtarına bağlıydı (olay bazlı seçim yoktu).
        // Artık Facility/Travel/SEDA ile aynı desen: her olayın kendi SMS ve push gövdesi, kendi
        // enabled bayrağı var. Etkinlik bazlı özelleştirme (ev.AccessJson) hâlâ global şablonu ezer.
        var template = ResolvePerEvent(ev.AccessJson, statusEvent)
            ?? cfg.NotificationTemplates?.FirstOrDefault(t => t.Event == statusEvent);

        if (cfg.Notifications.Push && template is not null && template.NotifyEnabled && !string.IsNullOrWhiteSpace(template.NotifyBody))
        {
            var pushBody = Render(template.NotifyBody, participant, ev, session, reason, waitlistPosition);
            try
            {
                var statusInfo = statusEvent switch
                {
                    "application_approved" or "application_registered" => "Onaylandı",
                    "application_waitlisted" => "Yedek Liste",
                    "application_rejected" => "Reddedildi",
                    "application_reviewing" => "İnceleniyor",
                    _ => null,
                };
                await inApp.CreateAsync(participant.Id, "Etkinlik Bildirimi", pushBody, "application",
                    "event", ev.Id.ToString(), ev.Name, null, statusInfo, ct);
            }
            catch (Exception ex) { log.LogStepResult("EventStatusPushFailed", new { statusEvent, ex.Message }); }
        }

        if (cfg.Notifications.Sms && template is not null && template.SmsEnabled && !string.IsNullOrWhiteSpace(template.SmsBody) && !string.IsNullOrWhiteSpace(participant.Phone))
        {
            var smsBody = Render(template.SmsBody, participant, ev, session, reason, waitlistPosition);
            try
            {
                await dispatcher.SendSmsAsync(participant.Phone!, smsBody, ct);
            }
            catch (Exception ex)
            {
                log.LogStepResult("EventStatusSmsFailed", new { statusEvent, ex.Message });
            }
        }
    }

    private static string Render(string template, Participant p, Event ev, Session? session, string? reason, int? waitlistPosition)
    {
        var name = p.FullName ?? string.Empty;
        var spaceIdx = name.IndexOf(' ');
        var firstName = spaceIdx > 0 ? name[..spaceIdx] : name;
        var lastName = spaceIdx > 0 ? name[(spaceIdx + 1)..] : string.Empty;
        var date = (session?.Date ?? ev.StartDate).ToString("dd.MM.yyyy", Tr);
        var sessionLabel = session is not null
            ? $"{session.Date.ToString("dd.MM.yyyy", Tr)} {session.StartTime}-{session.EndTime}"
            : string.Empty;

        return template
            .Replace("{{ad}}", firstName)
            .Replace("{{soyad}}", lastName)
            .Replace("{{etkinlik}}", ev.Name)
            .Replace("{{tarih}}", date)
            .Replace("{{seans}}", sessionLabel)
            .Replace("{{sira}}", waitlistPosition?.ToString(Tr) ?? string.Empty)
            .Replace("{{red_nedeni}}", reason ?? string.Empty);
    }
}
