using Hangfire;
using System.Net;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IEventAttendanceReminderJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Global Etkinlik Ayarları > Bildirimler bölümündeki reminder24h/reminder1h toggle'larını
/// gerçekten uygular. Önceden bu iki ayarın backend'de HİÇBİR karşılığı yoktu (hiçbir Hangfire
/// job'ı yoktu). Onaylı başvurular için etkinlik/seans başlangıcına ~24 saat ve ~1 saat kala
/// tek seferlik hatırlatma gönderir (in-app + varsa telefonu olan katılımcıya SMS, ayarlara göre).
/// EventApplication.Reminder24hSentAt/Reminder1hSentAt ile idempotent — bir başvuru için her
/// pencere yalnızca bir kez tetiklenir.
/// </summary>
/// DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR Hangfire denetimi, madde #5): [DisableConcurrentExecution]
/// eklendi. Prod'da WorkerCount=10 iken, bu job'ın (*/5 dk) bir çalıştırması uzarsa bir sonraki
/// tetiklemenin PARALEL başlayıp aynı EventApplication kaydına iki kez hatırlatma (SMS/bildirim)
/// göndermesi teorik olarak mümkündü (Reminder24hSentAt kontrolü ile SaveChangesAsync arasındaki
/// pencere). PostgreSQL storage üzerinde distributed lock ile bu artık engelleniyor.
[DisableConcurrentExecution(timeoutInSeconds: 300)]
public class EventAttendanceReminderJob(
    IUnitOfWork uow,
    IEventSettingsService eventSettings,
    INotificationService inApp,
    INotificationDispatcher dispatcher) : IEventAttendanceReminderJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var settings = await eventSettings.GetAsync(ct);
        if (!settings.Notifications.Reminder24h && !settings.Notifications.Reminder1h) return;

        var now = TurkeyTime.NowWallClock();
        var horizon = now.AddHours(25);

        // Yaklaşan (önümüzdeki ~25 saat içinde başlayacak) onaylı başvuruları getir.
        var upcoming = await uow.EventApplications.FindAsync(
            a => a.Status == "approved"
                 && (a.Reminder24hSentAt == null || a.Reminder1hSentAt == null)
                 && a.ReferenceDate >= now.Date && a.ReferenceDate <= horizon.Date,
            ct);
        if (upcoming.Count == 0) return;

        var eventIds = upcoming.Select(a => a.EventId).Distinct().ToList();
        var events = (await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct)).ToDictionary(e => e.Id);
        var sessionIds = upcoming.Where(a => a.SessionId.HasValue).Select(a => a.SessionId!.Value).Distinct().ToList();
        var sessions = sessionIds.Count == 0
            ? new Dictionary<Guid, Domain.Entities.Events.Session>()
            : (await uow.Sessions.FindAsync(s => sessionIds.Contains(s.Id), ct)).ToDictionary(s => s.Id);

        var changed = false;
        foreach (var app in upcoming)
        {
            if (!events.TryGetValue(app.EventId, out var ev)) continue;
            var session = app.SessionId.HasValue && sessions.TryGetValue(app.SessionId.Value, out var s) ? s : null;

            var startAt = ResolveStartAt(ev.StartDate, ev.StartTime, session);
            if (startAt is null) continue;

            var hoursUntil = (startAt.Value - now).TotalHours;
            if (hoursUntil < 0) continue;

            if (settings.Notifications.Reminder24h && app.Reminder24hSentAt is null && hoursUntil <= 24)
            {
                await SendReminderAsync(app, ev, "24 saat", startAt.Value, settings.Notifications.Email, ct);
                app.MarkReminder24hSent();
                uow.EventApplications.Update(app);
                changed = true;
            }

            if (settings.Notifications.Reminder1h && app.Reminder1hSentAt is null && hoursUntil <= 1)
            {
                await SendReminderAsync(app, ev, "1 saat", startAt.Value, settings.Notifications.Email, ct);
                app.MarkReminder1hSent();
                uow.EventApplications.Update(app);
                changed = true;
            }
        }

        if (changed) await uow.SaveChangesAsync(ct);
    }

    private static DateTime? ResolveStartAt(DateTime eventStartDate, string? eventStartTime, Domain.Entities.Events.Session? session)
    {
        if (session is not null)
        {
            if (!TryParseTime(session.StartTime, out var sh, out var sm)) return session.Date.Date;
            return session.Date.Date.AddHours(sh).AddMinutes(sm);
        }
        if (!TryParseTime(eventStartTime, out var h, out var m)) return eventStartDate.Date;
        return eventStartDate.Date.AddHours(h).AddMinutes(m);
    }

    private static bool TryParseTime(string? t, out int hour, out int minute)
    {
        hour = 0; minute = 0;
        if (string.IsNullOrEmpty(t) || !t.Contains(':')) return false;
        var parts = t.Split(':');
        return parts.Length >= 2 && int.TryParse(parts[0], out hour) && int.TryParse(parts[1], out minute);
    }

    // Kullanıcı isteği (2026-08-29): "belirlenen gün öncesi veya saat öncesi bildirim push
    // notification ile yapabilmesi lazım ... sistem ayarlarında bunu sms ve mail içinde
    // yapalım" — Notifications.Email ayarı DTO'da vardı ama hiçbir yerde kullanılmıyordu,
    // hatırlatmalar sadece in-app + SMS gönderiyordu. Artık ayar açıksa ve katılımcının
    // e-posta adresi varsa aynı hatırlatma e-posta olarak da gönderiliyor.
    private async Task SendReminderAsync(Domain.Entities.Events.EventApplication app, Domain.Entities.Events.Event ev, string window, DateTime startAt, bool emailEnabled, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(app.ParticipantId, ct);
        if (participant is null) return;

        var title = "Etkinlik Hatırlatma";
        var body = $"{ev.Name} etkinliği {startAt:dd.MM.yyyy HH:mm} tarihinde başlayacak ({window} kaldı).";

        await inApp.CreateAsync(participant.Id, title, body, "application",
            "event", ev.Id.ToString(), ev.Name, null, "Hatırlatma", ct);

        if (!string.IsNullOrWhiteSpace(participant.Phone))
            await dispatcher.SendSmsAsync(participant.Phone, $"{title}: {body}", ct);

        if (emailEnabled && !string.IsNullOrWhiteSpace(participant.Email))
        {
            // Denetim bulgusu 2026-09-01 (e-posta/SMTP turu): ev.Name admin panelinden
            // MustNotContainHtmlArtifacts ile korunuyor ama savunma katmanı olarak (ve
            // participant.FullName için) yine de kaçışlanıyor — LibraryNotificationService
            // ile aynı desen tutarlılığı.
            var html = $"<p>Merhaba {WebUtility.HtmlEncode(participant.FullName)},</p><p>{WebUtility.HtmlEncode(body)}</p>";
            try { await dispatcher.SendEmailAsync(participant.Email, title, html, ct); }
            catch { }
        }
    }
}
