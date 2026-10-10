using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Services;

public class LibraryNotificationService(
    INotificationDispatcher dispatcher,
    Nexora.Application.Features.Notifications.INotificationService notifications,
    INotificationRealtimeNotifier realtime,
    IUnitOfWork uow,
    ILibrarySettingsService settings,
    ISmsService sms,
    IConfiguration config,
    ISmsGovernanceService smsGovernance) : ILibraryNotificationService
{
    private const string StaffOverdueReferenceType = "library-overdue";

    private string MemberWarnChannel => (config["LibraryNotifications:MemberWarnChannel"] ?? "sms").Trim().ToLowerInvariant();

    // Denetim bulgusu 2026-08-08 (badger ajanı): eventKey'e karşılık gelen bir şablon DB'de
    // tanımlıysa (admin ayarlar ekranından girmişse) onu kullanır, render eder ve döner. Yoksa
    // null döner — çağıran taraf bu durumda mevcut hardcoded metne düşer (davranış değişikliği yok).
    private async Task<string?> TryRenderTemplateAsync(Guid libraryId, string eventKey, string channel, string memberName, LibraryNotificationContext ctx, CancellationToken ct)
    {
        var s = await settings.GetAsync(libraryId, ct);
        var template = s.NotificationTemplates?.FirstOrDefault(t => t.Event == eventKey);
        if (template is null) return null;
        var enabled = channel == "sms" ? template.SmsEnabled : template.NotifyEnabled;
        var body = channel == "sms" ? template.SmsBody : template.NotifyBody;
        if (!enabled || string.IsNullOrWhiteSpace(body)) return null;
        return LibraryMessageRenderer.Render(body, memberName, ctx);
    }

    public async Task NotifyGuardianOnExitAsync(Guid libraryId, string libraryName, string memberName, DateTime? birthDate, string? guardianPhone, CancellationToken ct)
    {
        if (!IsMinor(birthDate) || string.IsNullOrWhiteSpace(guardianPhone)) return;
        var ctx = new LibraryNotificationContext(libraryName, Date: DateTime.UtcNow);
        var rendered = await TryRenderTemplateAsync(libraryId, "exit_notification", "sms", memberName, ctx, ct);
        await dispatcher.SendSmsAsync(guardianPhone!, rendered ?? $"{memberName} kıraathaneden çıkış yaptı.", ct);
    }

    public async Task NotifyStaffOverdueAsync(Guid libraryId, string memberName, int overdueCount, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetEligibleAsync(libraryId, ct);
        // Participant tabanlı personelin (2026-08-04 revizyonu) AdminUserId'si yok — bu
        // in-app bildirim sistemi AdminUser'a bağlı olduğu için katılımcı-tabanlı personele
        // şimdilik gönderilmiyor (ayrı bir vatandaş bildirim kanalı gerekir, ürün kararı).
        var adminIds = staff
            .Where(x => x.IsActive && x.AdminUserId is Guid adminId && adminId != Guid.Empty)
            .Select(x => x.AdminUserId!.Value)
            .Distinct()
            .ToList();
        if (adminIds.Count == 0) return;

        // overdue_reminder şablonu personel bildirimleri için de kullanılabilir (notify kanalı).
        var s = await settings.GetAsync(libraryId, ct);
        var template = s.NotificationTemplates?.FirstOrDefault(t => t.Event == "overdue_reminder");
        var title = "Gecikmiş Emanet Uyarısı";
        var body = template is { NotifyEnabled: true } && !string.IsNullOrWhiteSpace(template.NotifyBody)
            ? LibraryMessageRenderer.Render(template.NotifyBody, memberName, new LibraryNotificationContext("", OverdueCount: overdueCount))
            : $"{memberName} giriş yaptı; teslim tarihi geçmiş {overdueCount} kitabı var.";

        var items = adminIds
            .Select(adminId => Notification.Create(adminId, title, body, StaffOverdueReferenceType, StaffOverdueReferenceType, libraryId.ToString()))
            .ToList();

        await uow.Notifications.AddRangeAsync(items, ct);
        await uow.SaveChangesAsync(ct);

        foreach (var n in items)
            await realtime.NotifyAdminAsync(
                n.RecipientId,
                new AdminNotificationPayload(n.Id, n.Title, n.Body, StaffOverdueReferenceType, n.ReferenceId, n.CreatedAt),
                ct);
    }

    public async Task NotifyMemberWarnAsync(Guid libraryId, string libraryName, string eventKey, Guid? participantId, string? phone, string memberName, string message, CancellationToken ct)
    {
        var channel = MemberWarnChannel;
        var ctx = new LibraryNotificationContext(libraryName, Date: DateTime.UtcNow, Message: message);

        if (channel is "sms" or "both" && !string.IsNullOrWhiteSpace(phone))
        {
            var rendered = await TryRenderTemplateAsync(libraryId, eventKey, "sms", memberName, ctx, ct);
            await dispatcher.SendSmsAsync(phone!, rendered ?? message, ct);
        }
        if (channel is "push" or "both" && participantId is Guid pid)
        {
            var rendered = await TryRenderTemplateAsync(libraryId, eventKey, "notify", memberName, ctx, ct);
            await notifications.CreateAsync(pid, "Kıraathane", rendered ?? message, "library-warn", ct);
        }

        // Kullanıcı isteği (2026-08-29): "sistem ayarlarında bunu sms ve mail içinde yapalım".
        // Rezervasyon giriş süresi dolmak üzere, mola bitmek üzere gibi "başlamadan/dolmadan
        // önce" uyarıları artık MemberWarnEmailEnabled açıksa e-posta ile de gönderiliyor.
        if (participantId is Guid emailPid)
            await TrySendMemberWarnEmailAsync(libraryId, libraryName, emailPid, message, ct);
    }

    private async Task TrySendMemberWarnEmailAsync(Guid libraryId, string libraryName, Guid participantId, string message, CancellationToken ct)
    {
        var s = await settings.GetAsync(libraryId, ct);
        if (!s.MemberWarnEmailEnabled) return;
        var participant = await uow.Participants.GetByIdAsync(participantId, ct);
        if (participant is null || string.IsNullOrWhiteSpace(participant.Email)) return;
        // Denetim bulgusu 2026-09-01 (e-posta/SMTP turu): libraryName (kıraathane adı,
        // admin girişi) ve message (personelin serbest metin uyarısı, WarnAsync üzerinden
        // gelir, HTML karakter engeli YOK) önceden ham haliyle e-posta HTML gövdesine
        // interpolasyonla giriyordu — bir personel uyarı metnine "<script>" veya
        // "<img onerror=...>" yazarsa vatandaşın e-posta istemcisinde çalışabilirdi
        // (stored HTML injection). WebUtility.HtmlEncode ile kaçışlanıyor; görünen metin
        // değişmiyor, yalnızca markup olarak yorumlanması engelleniyor.
        var html = $"<p>Merhaba {WebUtility.HtmlEncode(participant.FullName)},</p><p>{WebUtility.HtmlEncode(libraryName)}: {WebUtility.HtmlEncode(message)}</p>";
        try { await dispatcher.SendEmailAsync(participant.Email, "Kıraathane Bilgilendirme", html, ct); }
        catch { }
    }

    public async Task NotifyReservationCancelledAsync(Guid libraryId, Guid? participantId, string? phone, string memberName, string libraryName, bool byStaff, CancellationToken ct)
    {
        var fallback = byStaff
            ? $"{libraryName} kıraathanesindeki rezervasyonunuz yönetici tarafından iptal edildi."
            : $"{libraryName} kıraathanesindeki rezervasyonunuz iptal edildi.";
        var ctx = new LibraryNotificationContext(libraryName, Date: DateTime.UtcNow);

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var rendered = await TryRenderTemplateAsync(libraryId, "reservation_cancelled", "sms", memberName, ctx, ct);
            await dispatcher.SendSmsAsync(phone!, rendered ?? fallback, ct);
        }

        if (participantId is Guid pid)
        {
            var rendered = await TryRenderTemplateAsync(libraryId, "reservation_cancelled", "notify", memberName, ctx, ct);
            await notifications.CreateAsync(pid, "Rezervasyon İptal Edildi", rendered ?? fallback, "library-reservation", ct);
        }
    }

    public async Task NotifyReservationExpiredAsync(Guid libraryId, Guid? participantId, string? phone, string memberName, string libraryName, CancellationToken ct)
    {
        var fallback = $"{libraryName} kıraathanesindeki rezervasyonunuzun süresi doldu.";
        var ctx = new LibraryNotificationContext(libraryName, Date: DateTime.UtcNow);

        if (!string.IsNullOrWhiteSpace(phone))
        {
            var rendered = await TryRenderTemplateAsync(libraryId, "reservation_expired", "sms", memberName, ctx, ct);
            await dispatcher.SendSmsAsync(phone!, rendered ?? fallback, ct);
        }

        if (participantId is Guid pid)
        {
            var rendered = await TryRenderTemplateAsync(libraryId, "reservation_expired", "notify", memberName, ctx, ct);
            await notifications.CreateAsync(pid, "Rezervasyon Süresi Doldu", rendered ?? fallback, "library-reservation", ct);
        }
    }

    public async Task<LibraryManualMessageResultDto> SendManualMessageAsync(Guid libraryId, List<Guid>? sessionIds, string templateEvent, string? customText, bool smsChannel, bool notify, string? smsOtp, CancellationToken ct)
    {
        if (!smsChannel && !notify)
            throw new ConflictException("En az bir kanal seçin (SMS veya bildirim).", "NO_CHANNEL");

        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kütüphane bulunamadı.", "LIBRARY_NOT_FOUND");

        var s = await settings.GetAsync(libraryId, ct);
        var template = (s.NotificationTemplates ?? []).FirstOrDefault(t => t.Event == templateEvent);
        var smsBodyTemplate = customText ?? template?.SmsBody ?? string.Empty;
        var notifyBodyTemplate = customText ?? template?.NotifyBody ?? string.Empty;
        var smsEnabled = smsChannel && (customText is not null || (template?.SmsEnabled ?? false)) && !string.IsNullOrWhiteSpace(smsBodyTemplate);
        var notifyEnabled = notify && (customText is not null || (template?.NotifyEnabled ?? false)) && !string.IsNullOrWhiteSpace(notifyBodyTemplate);

        if (!smsEnabled && !notifyEnabled)
            throw new ConflictException("Gönderilecek şablon veya metin boş.", "EMPTY_MESSAGE");

        var sessions = await uow.LibrarySessions.GetActiveByLibraryAsync(libraryId, ct);
        if (sessionIds is { Count: > 0 })
            sessions = sessions.Where(x => sessionIds.Contains(x.Id)).ToList();
        if (smsEnabled) await smsGovernance.EnsureCanSendAsync("Library", templateEvent, sessions.Count, smsOtp, ct);

        var recipients = 0;
        var smsSent = 0;
        var notificationsCreated = 0;
        foreach (var session in sessions)
        {
            recipients++;
            var ctx = new LibraryNotificationContext(
                library.Name,
                Date: session.EntryTime,
                DurationMinutes: Math.Max(0, (int)(DateTime.UtcNow - session.EntryTime).TotalMinutes),
                StatusInfo: ResolveStatusInfo(session.Status),
                Message: customText ?? string.Empty);

            if (notifyEnabled && session.ParticipantId is Guid participantId)
            {
                var body = LibraryMessageRenderer.Render(notifyBodyTemplate, session.MemberName, ctx);
                await notifications.CreateAsync(participantId, "Kıraathane Bilgilendirme", body, "library-manual", ct);
                notificationsCreated++;
            }

            if (smsEnabled && !string.IsNullOrWhiteSpace(session.Phone))
            {
                var body = LibraryMessageRenderer.Render(smsBodyTemplate, session.MemberName, ctx);
                try { if (await dispatcher.SendSmsAsync(session.Phone!, body, ct)) smsSent++; }
                catch { }
            }
        }

        return new LibraryManualMessageResultDto(recipients, smsSent, notificationsCreated, smsEnabled && smsSent > 0 && sms.IsMockMode);
    }

    private static bool IsMinor(DateTime? birthDate)
    {
        if (birthDate is null) return false;
        var today = DateTime.UtcNow.Date;
        var age = today.Year - birthDate.Value.Year;
        if (birthDate.Value.Date > today.AddYears(-age)) age--;
        return age < 18;
    }

    private static string ResolveStatusInfo(string status) => status switch
    {
        LibrarySessionStatus.Inside => "İçeride",
        LibrarySessionStatus.OnBreakShort => "Kısa molada",
        LibrarySessionStatus.OnBreakLong => "Uzun molada",
        LibrarySessionStatus.BreakExpired => "Mola süresi doldu",
        LibrarySessionStatus.ExitPending => "Çıkış bekliyor",
        _ => "Aktif oturum"
    };
}

public class EmanetService(
    HttpClient http,
    IConfiguration config,
    Nexora.Application.Features.Integrations.IIntegrationSettingsService integrations,
    Microsoft.Extensions.Logging.ILogger<EmanetService> logger) : IEmanetService
{
    // Son başarılı/başarısız çağrı (süreç ömrü boyunca). Hatalar önceden tamamen yutuluyordu;
    // entegrasyon bozukken ekranda "gecikmiş kitap yok" görünüyordu.
    private static DateTime? _lastSuccessAt, _lastErrorAt;
    private static string? _lastError;

    // Kullanıcı isteği (2026-09-25): "sistemde olsun ama kullanmak istersek açarız". Bağlantı
    // Ayarlar > Entegrasyonlar > Flexcity'den açılır (anahtarlar şifreli saklanır). Panelde
    // yapılandırılmamışsa eski yol (appsettings/ortam: Emanet:*) geçerlidir. Varsayılan kapalı.
    private async Task<(string BaseUrl, string AppKey, string? SecurityCode)?> ResolveAsync(CancellationToken ct)
    {
        var panel = await integrations.ResolveFlexcityAsync(ct);
        if (panel is not null) return (panel.BaseUrl, panel.AppKey, panel.SecurityCode);
        if (!config.GetValue("Emanet:Enabled", false)) return null;
        var baseUrl = config["Emanet:BaseUrl"];
        var appKey = config["Emanet:AppKey"];
        if (string.IsNullOrWhiteSpace(baseUrl) || string.IsNullOrWhiteSpace(appKey)) return null;
        return (baseUrl, appKey, config["Emanet:SecurityCode"]);
    }

    public async Task<EmanetStatusDto> GetStatusAsync(CancellationToken ct)
    {
        var settings = (await integrations.GetAsync(ct)).Flexcity;
        var panelEnabled = settings?.Enabled ?? false;
        var enabled = panelEnabled || config.GetValue("Emanet:Enabled", false);
        var configured = await ResolveAsync(ct) is not null;
        return new(enabled, configured, _lastSuccessAt, _lastErrorAt, _lastError);
    }

    private void Fail(string msg)
    {
        _lastErrorAt = DateTime.UtcNow; _lastError = msg;
        logger.LogWarning("[EMANET] Flexcity sorgusu başarısız: {Error}", msg);
    }

    public async Task<EmanetOverdueResult> GetOverdueAsync(string tckn, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(tckn)) return EmanetOverdueResult.Empty;
        var cfg = await ResolveAsync(ct);
        if (cfg is null) return EmanetOverdueResult.Empty; // kapalı: sessizce atla (bilinçli tercih)
        var (baseUrl, appKey, securityCode) = cfg.Value;

        try
        {
            // Flexcity imzası: md5(güvenlikKodu + istekTarihi), tarih ISO-8601 +03:00 biçiminde.
            // Eski kod "xxx" (Java biçimi) kullanıyordu; .NET bunu tanımadığı için tarih "…41xxx"
            // olarak gidiyor ve imza hiçbir zaman tutmuyordu. Türkiye saati açıkça kullanılır.
            var requestDate = FlexcityRequestDate(DateTimeOffset.UtcNow);
            var md5Input = (securityCode ?? "") + requestDate;
            var md5Hash = Convert.ToHexString(System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(md5Input))).ToLower();

            var url = $"{baseUrl.TrimEnd('/')}/FlexCityUi/rest/json/Kts/FindAllKtsEnvanterHareket";
            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            // Şemasız (Bearer/Basic olmayan) özel biçim: Headers.Add doğrulamada FormatException
            // atıyordu, istek hiç gönderilmiyordu. Doğrulamasız eklenir.
            request.Headers.TryAddWithoutValidation("Authorization", $"applicationkey={appKey}, requestdate={requestDate}, md5hashcode={md5Hash}");
            request.Content = new StringContent($"tcKimlikNo={Uri.EscapeDataString(tckn)}", System.Text.Encoding.UTF8, "application/x-www-form-urlencoded");

            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                var code = (int)response.StatusCode;
                Fail(code is 401 or 403
                    ? $"Flexcity erişimi reddetti (HTTP {code}): uygulama anahtarı veya güvenlik kodu yanlış olabilir."
                    : code == 404
                        ? "Flexcity adresinde sorgu servisi bulunamadı (HTTP 404): sunucu adresi yanlış olabilir."
                        : $"Flexcity hata döndürdü (HTTP {code} {response.ReasonPhrase}).");
                return EmanetOverdueResult.Empty;
            }

            var hareketler = await response.Content.ReadFromJsonAsync<List<KtsEnvanterHareketDto>>(cancellationToken: ct) ?? [];
            _lastSuccessAt = DateTime.UtcNow;
            var now = DateTime.UtcNow;
            var overdue = hareketler
                .Where(h => h.TeslimEdilmeTarihi == null
                           && h.YasalGetirmeTarihi.HasValue
                           && h.YasalGetirmeTarihi.Value < now
                           && (h.TuruAsStr ?? "").Contains("ODUNC", StringComparison.OrdinalIgnoreCase))
                .Select(h => new EmanetOverdueBook(
                    Title: h.KtsEnvanterDto?.Name ?? h.KtsEnvanterDto?.Title ?? $"Kitap #{h.Id}",
                    Author: h.KtsEnvanterDto?.Author,
                    DueDate: h.YasalGetirmeTarihi!.Value,
                    DaysOverdue: (int)(now - h.YasalGetirmeTarihi!.Value).TotalDays
                ))
                .ToList();

            return overdue.Count == 0 ? EmanetOverdueResult.Empty : new EmanetOverdueResult(true, overdue.Count, overdue);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // Hata mesajında anahtar geçebilir, gizlenir. Sık hatalar anlaşılır dile çevrilir.
            var msg = ex switch
            {
                TaskCanceledException => "Flexcity sunucusu zamanında yanıt vermedi (adres yanlış ya da sunucu kapalı olabilir).",
                HttpRequestException h => $"Flexcity sunucusuna ulaşılamadı ({h.Message}).",
                System.Text.Json.JsonException => "Flexcity'den beklenmeyen bir yanıt geldi (adres doğru mu?).",
                _ => $"{ex.GetType().Name}: {ex.Message}",
            };
            if (!string.IsNullOrEmpty(appKey)) msg = msg.Replace(appKey, "***");
            Fail(msg);
            return EmanetOverdueResult.Empty;
        }
    }

    // Türkiye 2016'dan beri sabit UTC+3 (yaz saati yok).
    internal static string FlexcityRequestDate(DateTimeOffset utcNow)
        => utcNow.ToOffset(TimeSpan.FromHours(3)).ToString("yyyy-MM-dd'T'HH:mm:sszzz", System.Globalization.CultureInfo.InvariantCulture);

    public async Task<List<LibraryOverdueEntryDto>> GetAllOverdueForLibraryAsync(string libraryId, string libraryName, IEnumerable<(string tckn, string memberName)> members, CancellationToken ct)
    {
        var tasks = members.Select(async m =>
        {
            var result = await GetOverdueAsync(m.tckn, ct);
            if (!result.HasOverdue) return Enumerable.Empty<LibraryOverdueEntryDto>();
            return result.Books.Select(b => new LibraryOverdueEntryDto(
                MemberName: m.memberName,
                Tckn: IdentityMask.MaskTckn(m.tckn),
                LibraryId: libraryId,
                LibraryName: libraryName,
                BookTitle: b.Title,
                BookAuthor: b.Author,
                DueDate: b.DueDate,
                DaysOverdue: b.DaysOverdue
            ));
        });
        var results = await Task.WhenAll(tasks);
        return results.SelectMany(r => r).ToList();
    }
}
