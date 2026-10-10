using System.Text.Json;
using Nexora.Domain.Common;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class FacilityNotificationService(INotificationDispatcher dispatcher, INotificationService notifications, IUnitOfWork uow) : IFacilityNotificationService
{
    // Kullanıcı isteği (2026-10-06): "tüm devam/devamsızlık/üyelik/iptal bildirimlerinde SMS mi
    // push mu gitsin seçilebilsin" — önceden sadece 3 olayda (approved/waitlisted/rejected)
    // sabit kodlu in-app bildirim metni vardı, diğer tüm olaylar (devamsızlık, hatırlatma, iptal,
    // erteleme, acil durum) SADECE SMS gönderiyordu, push/in-app hiç tetiklemiyordu. Artık
    // Travel/SEDA/Library modülleriyle AYNI desen: her olay şablonunun kendi NotifyEnabled/
    // NotifyBody'si var, admin panelden her olay için SMS ve push bağımsız açılıp kapatılabilir.
    private static string StatusInfoFor(string statusEvent) => statusEvent switch
    {
        "application_approved" => "Onaylandı",
        "application_waitlisted" => "Yedek Liste",
        "application_rejected" => "Reddedildi",
        "waitlist_promoted" => "Onaylandı",
        "attendance_absent" => "Devamsızlık",
        "absence_warning" => "Devamsızlık Uyarısı",
        "absence_limit_reached" => "Kayıt İptal",
        "session_reminder" => "Hatırlatma",
        "registration_cancelled" => "İptal Edildi",
        "postponed" => "Ertelendi",
        "emergency" => "Acil Duyuru",
        _ => "Bilgilendirme",
    };

    public async Task SendStatusAsync(string module, string statusEvent, string? phone, string fullName, FacilityNotificationVars vars, CancellationToken ct, Guid? participantId = null)
    {
        var settings = await uow.FacilitySettings.GetGeneralAsync(module, ct);
        var template = FindTemplate(settings?.SettingsJson, statusEvent);
        // Hiçbir yerde tanımlı değilse (admin ayarlar ekranını hiç açmamış) gömülü varsayılanlara düş —
        // mevcut davranış (2026-08-08 denetimi) korunur.
        var (smsEnabled, smsBody, notifyEnabled, notifyBody) = template
            ?? (DefaultSmsEnabled(statusEvent), DefaultSmsTemplate(statusEvent) ?? "", DefaultNotifyEnabled(statusEvent), DefaultSmsTemplate(statusEvent) ?? "");

        var effectiveVars = vars;
        if (string.IsNullOrEmpty(vars.ConfirmHours))
        {
            var confirmHours = FacilitySettingsValues.Int(settings?.SettingsJson, "waitlistConfirmHours");
            if (confirmHours.HasValue) effectiveVars = vars with { ConfirmHours = confirmHours.Value.ToString() };
        }

        if (notifyEnabled && !string.IsNullOrWhiteSpace(notifyBody) && participantId is Guid pid)
        {
            var inAppBody = RenderStatus(notifyBody, fullName, effectiveVars);
            await notifications.CreateAsync(pid, StatusInfoFor(statusEvent), inAppBody, "facility-application",
                "facility", null, vars.FacilityName, null, StatusInfoFor(statusEvent), ct);
        }

        if (!smsEnabled || string.IsNullOrWhiteSpace(smsBody) || string.IsNullOrWhiteSpace(phone)) return;

        var body = RenderStatus(smsBody, fullName, effectiveVars);
        try { await dispatcher.SendSmsAsync(phone!, body, ct); }
        catch { }
    }

    private static bool DefaultSmsEnabled(string statusEvent) => statusEvent is
        "application_approved" or "application_rejected" or "waitlist_promoted" or "absence_warning" or "manual";

    // Push varsayılan daha geniş: ücretsiz, müdahaleci olmayan bir kanal olduğu için SMS'in aksine
    // (ücretli, dış sağlayıcı) tüm durum bildirimlerinde varsayılan AÇIK — admin dilerse kapatabilir.
    private static bool DefaultNotifyEnabled(string statusEvent) => statusEvent != "manual";

    private static string? DefaultSmsTemplate(string statusEvent) => statusEvent switch
    {
        "application_approved" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) başvurunuz onaylandı.",
        "application_rejected" => "Sayın {{ad}} {{soyad}}, {{grup}} başvurunuz reddedildi. {{red_nedeni}}",
        "application_pending" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) başvurunuz alındı, onay bekliyor.",
        "application_waitlisted" => "Sayın {{ad}} {{soyad}}, {{grup}} için yedek listeye alındınız. Sıra: {{sira}}.",
        "application_documents_required" => "Sayın {{ad}} {{soyad}}, {{grup}} başvurunuz için şu belgeler gerekli: {{evrak_listesi}}",
        "attendance_absent" => "Sayın {{ad}} {{soyad}}, {{seans_tarihi}} tarihli {{grup}} seansına katılmadığınız kaydedildi.",
        "absence_warning" => "Sayın {{ad}} {{soyad}}, {{grup}} devamsızlık hakkınız: {{kalan_hak}}/{{limit}}. Lütfen dikkat ediniz.",
        "absence_limit_reached" => "Sayın {{ad}} {{soyad}}, {{grup}} devamsızlık limitiniz ({{limit}}) doldu, kaydınız iptal edildi.",
        "session_reminder" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) seansınız {{seans_saati}} saatinde başlayacak.",
        "waitlist_promoted" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) programında yer açıldı, kaydınız onaylandı. İlk katılımınız: {{seans_tarihi}} {{seans_saati}}.",
        "registration_cancelled" => "Sayın {{ad}} {{soyad}}, {{grup}} kaydınız iptal edildi. {{iptal_nedeni}}",
        "postponed" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) programı ertelendi. Yeni tarih: {{seans_tarihi}}.",
        "emergency" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) ile ilgili acil bir duyuru bulunmaktadır. Lütfen yetkiliyle iletişime geçin.",
        "manual" => "Sayın {{ad}} {{soyad}}, {{grup}} ({{tesis}}) programı hakkında bilgilendirme: ",
        _ => null,
    };

    private static (bool SmsEnabled, string SmsBody, bool NotifyEnabled, string NotifyBody)? FindTemplate(string? settingsJson, string statusEvent)
    {
        if (string.IsNullOrWhiteSpace(settingsJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(settingsJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("notificationTemplates", out var arr)
                || arr.ValueKind != JsonValueKind.Array) return null;
            foreach (var t in arr.EnumerateArray())
            {
                if (t.ValueKind != JsonValueKind.Object) continue;
                var ev = t.TryGetProperty("event", out var e) ? e.GetString() : null;
                if (!string.Equals(ev, statusEvent, StringComparison.OrdinalIgnoreCase)) continue;
                var smsEnabled = t.TryGetProperty("smsEnabled", out var se) && se.ValueKind == JsonValueKind.True;
                var smsBody = t.TryGetProperty("smsBody", out var sb) && sb.ValueKind == JsonValueKind.String ? sb.GetString() ?? "" : "";
                // Kullanıcı isteği (2026-10-06): mevcut SMS alanlarıyla simetrik push alanları.
                // Admin hiç push alanı kaydetmediyse (eski kayıtlı ayarlar, alan yoksa) varsayılan
                // olarak AÇIK ve SMS metniyle aynı içerik kullanılır — admin panel ilk açılışta
                // zaten DEFAULT_TEMPLATES'ten dolu notifyBody gönderir, bu sadece eski/kısmi kayıtlar
                // için güvenli bir düşüş (geriye dönük uyumluluk).
                var notifyEnabled = !t.TryGetProperty("notifyEnabled", out var ne) || ne.ValueKind != JsonValueKind.False;
                var notifyBody = t.TryGetProperty("notifyBody", out var nb) && nb.ValueKind == JsonValueKind.String ? nb.GetString() ?? "" : smsBody;
                return (smsEnabled, smsBody, notifyEnabled, notifyBody);
            }
        }
        catch { }
        return null;
    }

    private static string RenderStatus(string template, string fullName, FacilityNotificationVars v)
    {
        var name = fullName ?? string.Empty;
        var idx = name.IndexOf(' ');
        var first = idx > 0 ? name[..idx] : name;
        var last = idx > 0 ? name[(idx + 1)..] : string.Empty;
        return template
            .Replace("{{ad}}", first)
            .Replace("{{soyad}}", last)
            .Replace("{{grup}}", v.GroupName ?? string.Empty)
            .Replace("{{tesis}}", v.FacilityName ?? string.Empty)
            .Replace("{{tarih}}", v.Date ?? string.Empty)
            .Replace("{{red_nedeni}}", v.Reason ?? string.Empty)
            .Replace("{{sira}}", v.WaitlistPosition?.ToString() ?? string.Empty)
            .Replace("{{seans_tarihi}}", v.SessionDate ?? string.Empty)
            .Replace("{{devamsizlik_sayisi}}", v.AbsenceCount?.ToString() ?? string.Empty)
            .Replace("{{kalan_hak}}", v.RemainingRight?.ToString() ?? string.Empty)
            .Replace("{{limit}}", v.Limit?.ToString() ?? string.Empty)
            .Replace("{{seans_saati}}", v.SessionTime ?? string.Empty)
            .Replace("{{onay_suresi}}", v.ConfirmHours ?? string.Empty)
            .Replace("{{evrak_listesi}}", v.DocumentList ?? string.Empty)
            .Replace("{{iptal_nedeni}}", v.CancelReason ?? string.Empty);
    }

    public async Task NotifyAttendanceAsync(FacilitySession session, string groupName, IReadOnlyList<(FacilityRegistration Registration, string Status)> results, CancellationToken ct)
    {
        foreach (var (registration, status) in results)
        {
            var message = $"{session.Date:dd.MM.yyyy} {groupName} yoklaması: {StatusText(status)}.";

            if (!string.IsNullOrWhiteSpace(registration.Phone))
                await dispatcher.SendSmsAsync(registration.Phone, message, ct);
            if (registration.ParticipantId is Guid attendancePid)
                await notifications.CreateAsync(attendancePid, status == "absent" ? "Devamsızlık bildirimi" : "Yoklama bilgisi", message, "facility-attendance", ct);

            if (IsMinor(registration.BirthDate) && !string.IsNullOrWhiteSpace(registration.GuardianPhone))
            {
                if (status == "absent")
                    await NotifyGuardianChildAbsenceAsync(registration, session.Date, groupName, ct);
                else
                    await dispatcher.SendSmsAsync(registration.GuardianPhone!, message, ct);
            }
        }
    }

    private async Task NotifyGuardianChildAbsenceAsync(FacilityRegistration registration, DateTime sessionDate, string groupName, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(registration.GuardianPhone)) return;
        var message = $"Sayın veli, {registration.FullName} adlı çocuğunuz {sessionDate:dd.MM.yyyy} tarihli {groupName} programına katılmadı. Devamsızlık olarak işlenmiştir.";
        await dispatcher.SendSmsAsync(registration.GuardianPhone!, message, ct);
    }

    public async Task NotifySessionCancelledAsync(FacilitySession session, string groupName, IReadOnlyList<FacilityRegistration> roster, string? reason, CancellationToken ct)
    {
        var message = $"{session.Date:dd.MM.yyyy} {groupName} seansı iptal edildi."
            + (string.IsNullOrWhiteSpace(reason) ? "" : $" Açıklama: {reason}");
        foreach (var registration in roster)
            await NotifyParticipantAndGuardianAsync(registration, message, ct);
    }

    public async Task NotifyBulkSessionsCancelledAsync(IReadOnlyList<FacilityRegistration> participants, string scopeLabel, DateTime startDate, DateTime endDate, string? reason, CancellationToken ct)
    {
        var dateText = startDate.Date == endDate.Date
            ? $"{startDate:dd.MM.yyyy} tarihindeki"
            : $"{startDate:dd.MM.yyyy} - {endDate:dd.MM.yyyy} tarihleri arasındaki";
        var message = $"{dateText} {scopeLabel} seansları iptal edilmiştir."
            + (string.IsNullOrWhiteSpace(reason) ? "" : $" Açıklama: {reason}");
        foreach (var registration in participants)
            await NotifyParticipantAndGuardianAsync(registration, message, ct);
    }

    public async Task NotifySessionReopenedAsync(FacilitySession session, string groupName, IReadOnlyList<FacilityRegistration> roster, CancellationToken ct)
    {
        var message = $"{session.Date:dd.MM.yyyy} {groupName} seansı tekrar açıldı.";
        foreach (var registration in roster)
            await NotifyParticipantAndGuardianAsync(registration, message, ct, "Seans tekrar açıldı");
    }

    public async Task NotifyBulkSessionsReopenedAsync(IReadOnlyList<FacilityRegistration> participants, string scopeLabel, DateTime startDate, DateTime endDate, CancellationToken ct)
    {
        var dateText = startDate.Date == endDate.Date
            ? $"{startDate:dd.MM.yyyy} tarihindeki"
            : $"{startDate:dd.MM.yyyy} - {endDate:dd.MM.yyyy} tarihleri arasındaki";
        var message = $"{dateText} {scopeLabel} seansları tekrar açılmıştır.";
        foreach (var registration in participants)
            await NotifyParticipantAndGuardianAsync(registration, message, ct, "Seans tekrar açıldı");
    }

    public async Task NotifyInstructorAttendanceReminderAsync(string? instructorPhone, string instructorName, DateTime sessionDate, string startTime, string groupName, string link, int remainingMinutes, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(instructorPhone)) return;
        var message = $"Sayın {instructorName}, {sessionDate:dd.MM.yyyy} {startTime} {groupName} seansının yoklamasını almak için son {remainingMinutes} dakikanız kaldı."
            + (string.IsNullOrWhiteSpace(link) ? "" : $" Yoklama: {link}");
        await dispatcher.SendSmsAsync(instructorPhone, message, ct);
    }

    private async Task NotifyParticipantAndGuardianAsync(FacilityRegistration registration, string message, CancellationToken ct, string title = "Seans iptali")
    {
        var minor = IsMinor(registration.BirthDate);

        if (!string.IsNullOrWhiteSpace(registration.Phone))
            await dispatcher.SendSmsAsync(registration.Phone, message, ct);

        if (minor && !string.IsNullOrWhiteSpace(registration.GuardianPhone))
            await dispatcher.SendSmsAsync(registration.GuardianPhone!, message, ct);

        if (registration.ParticipantId is Guid pid)
            await notifications.CreateAsync(pid, title, message, "facility-session", ct);
    }

    private static bool IsMinor(DateTime? birthDate)
    {
        if (birthDate is null) return false;
        var today = TurkeyTime.TodayDate();
        var age = today.Year - birthDate.Value.Year;
        if (birthDate.Value.Date > today.AddYears(-age)) age--;
        return age < 18;
    }

    private static string StatusText(string status) => status switch
    {
        "present" => "Katıldı",
        "late" => "Geç katıldı",
        _ => "Gelmedi",
    };
}
