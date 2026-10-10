using Hangfire;
using System.Net;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Travels;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Common;
using Nexora.Infrastructure.Services;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface ITravelDepartureReminderJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Kalkışına ~N saat (varsayılan 25, TravelSettings.General.AttendanceReminderHoursBeforeDeparture'dan
/// ayarlanabilir) kalan seferler için onaylı/yedekte-olmayan katılımcılara tek seferlik hatırlatma
/// bildirimi gönderir (in-app + varsa telefonu olan katılımcıya SMS). Travel.AttendanceReminderSentAt
/// alanı ile idempotent — bir sefer için hatırlatma yalnızca bir kez gönderilir.
///
/// Kullanıcı isteği (2026-08-07): mesaj metni artık TravelSettings'teki "departure_reminder"
/// şablonundan okunuyor (önceden hardcoded'dı). Aynı Travel.AttendanceReminderSentAt bayrağı,
/// admin manuel/toplu mesaj ekranından "departure_reminder" şablonunu elle gönderirse de
/// işaretlenir (TravelManualMessageService) — böylece bu job aynı seferi bir daha işlemez ve
/// aynı hatırlatma iki kez gitmez.
/// </summary>
/// DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR Hangfire denetimi, madde #5): aynı gerekçe ile
/// [DisableConcurrentExecution] eklendi (bkz. EventAttendanceReminderJob).
[DisableConcurrentExecution(timeoutInSeconds: 300)]
public class TravelDepartureReminderJob(
    IUnitOfWork uow,
    ITravelSettingsService travelSettings,
    ITravelNotificationService notifications,
    INotificationDispatcher dispatcher) : ITravelDepartureReminderJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var settings = await travelSettings.GetAsync(ct);
        var reminderHours = settings.General.AttendanceReminderHoursBeforeDeparture > 0
            ? settings.General.AttendanceReminderHoursBeforeDeparture
            : 25;
        // Kullanıcı isteği (2026-08-29): "sistem ayarlarında bunu sms ve mail içinde
        // yapalım" — TravelNotificationService şablon bazlı SMS/uygulama-içi gönderiyor
        // ama e-posta hiç desteklemiyordu; ayrı bir şablon alanı eklemek yerine (geziler
        // için tüm hatırlatma metinleri zaten aynı) departure_reminder şablonunun SMS
        // metnini, ayar açıksa doğrudan e-posta gövdesi olarak da kullanıyoruz.
        var template = (settings.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == "departure_reminder");

        // UAT 2026-09-24: Travel.StartDate UTC saklanır; duvar saati (UTC+3) ile kıyas hatırlatmayı
        // 3 saat erken gönderiyordu. UTC ile kıyaslanır.
        var now = DateTime.UtcNow;

        var travels = await uow.Travels.FindAsync(
            t => t.IsActive && t.AttendanceReminderSentAt == null && t.StartDate > now, ct);
        if (travels.Count == 0) return;

        var changed = false;
        foreach (var travel in travels)
        {
            if (now < travel.StartDate.AddHours(-reminderHours)) continue;

            var applications = await uow.TravelApplications.FindAsync(
                a => a.TravelId == travel.Id && (a.Status == "approved" || a.Status == "waitlist"), ct);

            var ctx = new TravelNotificationContext(travel.Name, travel.StartDate, travel.Destination, travel.DeparturePoint);
            foreach (var app in applications)
            {
                var participant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
                if (participant is null) continue;

                // "waitlist" durumundaki katılımcılar da hatırlatma alır ama gönderilen şablon
                // her ikisi için de "departure_reminder" — durum farkı ayrı bir olay değil,
                // sadece {{sira}} boş kalır (yedek listedekiler için sıra numarası burada
                // hesaplanmıyor, sadece onaylı yolculara özgü bir alan).
                await notifications.SendStatusAsync(app.ParticipantId, participant.Phone, participant.FullName, ctx, "departure_reminder", null, ct);

                if (settings.General.AttendanceReminderEmailEnabled && !string.IsNullOrWhiteSpace(participant.Email)
                    && template is not null && !string.IsNullOrWhiteSpace(template.SmsBody))
                {
                    var body = TravelMessageRenderer.Render(template.SmsBody, participant.FullName, ctx, null);
                    // Denetim bulgusu 2026-09-01 (e-posta/SMTP turu): body, admin ayarlarındaki
                    // "departure_reminder" şablonundan (TravelSettings, HTML karakter engeli
                    // yok) render ediliyor; participant.FullName de NVI kaynaklı olsa da
                    // savunma amaçlı kaçışlanıyor. Önceden ikisi de kaçışsız e-posta HTML
                    // gövdesine giriyordu (stored HTML injection riski, bkz. LibraryNotificationService
                    // aynı desen).
                    var html = $"<p>Merhaba {WebUtility.HtmlEncode(participant.FullName)},</p><p>{WebUtility.HtmlEncode(body)}</p>";
                    try { await dispatcher.SendEmailAsync(participant.Email, "Gezi Hatırlatma", html, ct); }
                    catch { }
                }
            }

            travel.MarkAttendanceReminderSent();
            uow.Travels.Update(travel);
            changed = true;
        }

        if (changed) await uow.SaveChangesAsync(ct);
    }
}
