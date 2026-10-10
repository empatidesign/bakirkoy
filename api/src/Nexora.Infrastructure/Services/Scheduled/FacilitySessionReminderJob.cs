using Hangfire;
using System.Net;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Services.Scheduled;

public interface IFacilitySessionReminderJob
{
    Task RunAsync(CancellationToken ct);
}

/// <summary>
/// Tesis (havuz/spor/kâşif/vs.) seansı başlamadan ~N saat önce (modül bazlı GeneralSettings.SettingsJson
/// içindeki "sessionReminderHoursBefore", varsayılan 24; "sessionReminderEnabled"=false ise hiç gönderilmez)
/// o seansın grubundaki aktif ana listedeki katılımcılara tek seferlik hatırlatma bildirimi gönderir
/// (in-app + varsa telefonu olan katılımcıya SMS — mock modda gerçek SMS gitmez).
/// FacilitySession.ParticipantReminderSentAt alanı ile idempotent.
/// </summary>
/// DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR Hangfire denetimi, madde #5): aynı gerekçe ile
/// [DisableConcurrentExecution] eklendi (bkz. EventAttendanceReminderJob).
[DisableConcurrentExecution(timeoutInSeconds: 300)]
public class FacilitySessionReminderJob(
    IUnitOfWork uow,
    INotificationService inApp,
    INotificationDispatcher dispatcher) : IFacilitySessionReminderJob
{
    public async Task RunAsync(CancellationToken ct)
    {
        var now = TurkeyTime.NowWallClock();
        var changed = false;

        foreach (var module in FacilityModuleRegistry.All)
        {
            var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
            var enabled = FacilitySettingsValues.Bool(settings?.SettingsJson, "sessionReminderEnabled") ?? true;
            if (!enabled) continue;

            var hoursBefore = FacilitySettingsValues.Int(settings?.SettingsJson, "sessionReminderHoursBefore") ?? 24;
            if (hoursBefore <= 0) continue;

            // Kullanıcı isteği (2026-08-29): "sistem ayarlarında bunu sms ve mail içinde
            // yapalım" — Facility hatırlatmasında da e-posta kanalı, admin ayarındaki yeni
            // "sessionReminderEmailEnabled" anahtarına göre (varsayılan kapalı, mevcut
            // davranışı bozmasın diye) devreye giriyor.
            var emailEnabled = FacilitySettingsValues.Bool(settings?.SettingsJson, "sessionReminderEmailEnabled") ?? false;

            var sessions = await uow.FacilitySessions.FindAsync(
                s => s.Module == module && !s.IsCancelled && s.ParticipantReminderSentAt == null
                     && s.Date >= now.Date, ct);
            if (sessions.Count == 0) continue;

            foreach (var session in sessions)
            {
                if (!TryParseTime(session.StartTime, out var h, out var m)) continue;
                var start = session.Date.Date.AddHours(h).AddMinutes(m);
                if (start <= now) continue;
                if (now < start.AddHours(-hoursBefore)) continue;

                var group = await uow.FacilityGroups.GetByIdAsync(session.GroupId, ct);
                if (group is null) continue;

                var roster = (await uow.FacilityRegistrations.GetByGroupAsync(session.GroupId, ct))
                    .Where(r => r.Status == "active" && r.Kind == "main").ToList();

                foreach (var reg in roster)
                {
                    if (!reg.ParticipantId.HasValue) continue;
                    var participant = await uow.Participants.GetByIdAsync(reg.ParticipantId.Value, ct);
                    if (participant is null) continue;

                    var title = "Seans Hatırlatma";
                    var body = $"{group.Name} grubundaki seansınız {start:dd.MM.yyyy HH:mm} tarihinde başlayacak. Lütfen zamanında hazır olun.";

                    await inApp.CreateAsync(participant.Id, title, body, "application",
                        "facility", session.Id.ToString(), group.Name, session.StartTime, "Hatırlatma", ct);

                    if (!string.IsNullOrWhiteSpace(participant.Phone))
                        await dispatcher.SendSmsAsync(participant.Phone, $"{title}: {body}", ct);

                    if (emailEnabled && !string.IsNullOrWhiteSpace(participant.Email))
                    {
                        // Denetim bulgusu 2026-09-01 (e-posta/SMTP turu): group.Name admin
                        // panelinden MustNotContainHtmlArtifacts ile korunuyor ama savunma
                        // katmanı olarak (ve participant.FullName için) yine de kaçışlanıyor.
                        var html = $"<p>Merhaba {WebUtility.HtmlEncode(participant.FullName)},</p><p>{WebUtility.HtmlEncode(body)}</p>";
                        try { await dispatcher.SendEmailAsync(participant.Email, title, html, ct); }
                        catch { }
                    }
                }

                session.MarkParticipantReminderSent();
                uow.FacilitySessions.Update(session);
                changed = true;
            }
        }

        if (changed) await uow.SaveChangesAsync(ct);
    }

    private static bool TryParseTime(string? t, out int hour, out int minute)
    {
        hour = 0; minute = 0;
        if (string.IsNullOrEmpty(t) || !t.Contains(':')) return false;
        var parts = t.Split(':');
        return parts.Length >= 2 && int.TryParse(parts[0], out hour) && int.TryParse(parts[1], out minute);
    }
}
