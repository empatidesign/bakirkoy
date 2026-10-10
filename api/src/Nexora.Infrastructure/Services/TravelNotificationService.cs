using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-07): Gezi modülündeki başvuru/onay/ret/yedek liste/iptal
/// bildirimleri artık TravelSettings'teki birleşik şablon sisteminden okunuyor (önceden
/// C# switch içinde hardcoded Türkçe metinlerdi — admin bunları hiç değiştiremiyordu).
/// SMS ve uygulama-içi bildirim kanalları şablon bazında ayrı ayrı aç/kapa edilebilir.
/// </summary>
public class TravelNotificationService(
    INotificationDispatcher dispatcher,
    INotificationService inApp,
    ITravelSettingsService travelSettings) : ITravelNotificationService
{
    private static readonly Dictionary<string, string> StatusInfoLabels = new()
    {
        ["application_received"] = "Başvuru Alındı",
        ["approved"] = "Onaylandı",
        ["rejected"] = "Reddedildi",
        ["waitlist"] = "Yedek Liste",
        ["promoted"] = "Yedekten Çıktı",
        ["promoted_approved"] = "Onaylandı",
        ["cancelled"] = "İptal Edildi",
    };

    public async Task SendStatusAsync(Guid participantId, string? phone, string fullName, TravelNotificationContext travel, string status, int? waitlistPosition, CancellationToken ct, string? reason = null)
    {
        var settings = await travelSettings.GetAsync(ct);
        var template = (settings.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == status);
        if (template is null) return;

        var statusInfo = StatusInfoLabels.GetValueOrDefault(status, status);

        if (template.NotifyEnabled && !string.IsNullOrWhiteSpace(template.NotifyBody))
        {
            var body = TravelMessageRenderer.Render(template.NotifyBody, fullName, travel, waitlistPosition) + ReasonSuffix(reason);
            await inApp.CreateAsync(participantId, statusInfo, body, "application",
                "travel", null, travel.TravelName, null, statusInfo, ct);
        }

        if (template.SmsEnabled && !string.IsNullOrWhiteSpace(template.SmsBody) && !string.IsNullOrWhiteSpace(phone))
        {
            var smsBody = TravelMessageRenderer.Render(template.SmsBody, fullName, travel, waitlistPosition) + ReasonSuffix(reason);
            try { await dispatcher.SendSmsAsync(phone!, smsBody, ct); }
            catch { }
        }
    }

    private static string ReasonSuffix(string? reason)
        => string.IsNullOrWhiteSpace(reason) ? "" : $" Gerekçe: {reason}";
}
