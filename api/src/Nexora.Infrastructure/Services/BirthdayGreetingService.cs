using System.Text.Json;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-09-07): doğum günü olan vatandaşlara her gün belirlenen saatte
/// (varsayılan 10:00) otomatik kutlama gönderir.
///
/// Tasarım kararları:
/// - <b>Kanallar:</b> kayıtlı cep telefonuna SMS + mobil push + uygulama içi bildirim; üçü de
///   ayarlardan ayrı ayrı açılıp kapatılabilir (kullanıcı "mesaj mı, push mu, ikisi mi?" diye
///   sordu — cevap: ikisi de, ama seçim admin'e bırakıldı).
/// - <b>Kişiye özel:</b> metinlerde {{ad}} {{soyad}} {{adsoyad}} {{yas}} değişkenleri desteklenir.
/// - <b>Kademeli gönderim:</b> binlerce kişinin aynı gün doğum günü olabilir; her kişi arasında
///   ThrottleMilliseconds, her BatchSize kişide bir BatchPauseMilliseconds beklenir. Böylece SMS
///   sağlayıcısı ve sistem tıkanmaz.
/// - <b>Mükerrer koruma:</b> son başarılı çalıştırma günü ModuleNotificationSettings tablosunda
///   "birthday:state" satırında tutulur; aynı gün ikinci kez çalışsa da tekrar göndermez.
/// - <b>Saat kontrolü:</b> Hangfire job'ı her saat başı tetiklenir, gönderim yalnızca ayarlanan
///   saat/dakika geldiyse yapılır. Böylece admin saati değiştirdiğinde cron'u yeniden kaydetmek
///   gerekmez.
/// </summary>
public class BirthdayGreetingService(
    IUnitOfWork uow,
    ISmsService sms,
    IPushSender push,
    IRedisService redis,
    ILogger<BirthdayGreetingService> logger) : IBirthdayGreetingService
{
    private const string SettingsModule = "birthday";
    private const string StateModule = "birthday:state";
    private const string NotificationType = "birthday";

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): "yanlış gönderim olmaması için gerektiğinde kapat dediğimizde
    /// tüm liste iptal edilebilsin, ekranda kaç mesaj beklediği uyarısı çıksın."
    ///
    /// DURUM REDIS'TE TUTULUR — canlı doğrulamada bulunan kusur (2026-09-07): ilerleme/iptal
    /// bayrağı önce süreç içi statik alandaydı. Prod'da 3 API instance'ı + nginx round-robin
    /// çalıştığı için gönderimi başlatan instance ile "İptal"/"durum" isteğini alan instance
    /// FARKLI olabiliyordu; iptal isteği "süren gönderim yok" diyerek düşüyor, durum ekranı
    /// bekleyen mesajı 0 gösteriyordu (canlı kanıt: 20/20 mesaj iptale rağmen gönderildi).
    /// Redis paylaşımlı olduğundan hangi instance'a düşerse düşsün iptal gönderimi durdurur.
    /// </summary>
    private const string ProgressKey = "birthday:progress";
    private static readonly TimeSpan ProgressTtl = TimeSpan.FromHours(6);

    private sealed record BirthdayProgress(
        string State,
        int Total,
        int Processed,
        int SmsSent,
        int PushSent,
        int InAppCreated,
        DateTime? StartedAt,
        DateTime? FinishedAt,
        string? CancelledBy)
    {
        public static readonly BirthdayProgress Idle =
            new("idle", 0, 0, 0, 0, 0, null, null, null);

        public bool IsRunning => State is "running" or "cancelling";
        public int Pending => Math.Max(Total - Processed, 0);
    }

    private async Task<BirthdayProgress> GetProgressAsync(CancellationToken ct)
    {
        try { return await redis.GetAsync<BirthdayProgress>(ProgressKey, ct) ?? BirthdayProgress.Idle; }
        catch (Exception ex)
        {
            // Redis erişilemezse durum bilgisi kaybolur ama gönderim engellenmemeli.
            logger.LogWarning(ex, "Doğum günü ilerleme durumu okunamadı");
            return BirthdayProgress.Idle;
        }
    }

    private async Task SetProgressAsync(BirthdayProgress p, CancellationToken ct)
    {
        try { await redis.SetAsync(ProgressKey, p, ProgressTtl, ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Doğum günü ilerleme durumu yazılamadı"); }
    }

    public async Task<BirthdaySettingsDto> GetSettingsAsync(CancellationToken ct)
    {
        var record = await uow.ModuleNotificationSettings.GetByModuleAsync(SettingsModule, ct);
        if (record is null) return new BirthdaySettingsDto();
        try
        {
            return JsonSerializer.Deserialize<BirthdaySettingsDto>(record.ConfigJson, JsonOpts) ?? new BirthdaySettingsDto();
        }
        catch (JsonException)
        {
            // Bozuk JSON sistemin durmasına yol açmasın; varsayılanlara dön.
            logger.LogWarning("Doğum günü ayarları okunamadı, varsayılanlar kullanılıyor");
            return new BirthdaySettingsDto();
        }
    }

    public async Task<BirthdaySettingsDto> SaveSettingsAsync(BirthdaySettingsDto dto, CancellationToken ct)
    {
        var safe = Sanitize(dto);
        var json = JsonSerializer.Serialize(safe, JsonOpts);
        var record = await uow.ModuleNotificationSettings.GetByModuleAsync(SettingsModule, ct);
        if (record is null)
        {
            record = ModuleNotificationSettings.Create(SettingsModule, json);
            await uow.ModuleNotificationSettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(json);
            uow.ModuleNotificationSettings.Update(record);
        }
        await uow.SaveChangesAsync(ct);

        // Kullanıcı isteği: "gerektiğinde kapat dediğimizde tüm liste iptal edilebilir".
        // Otomatik gönderim kapatıldığında, o an SÜREN gönderim de durdurulur — aksi halde
        // "kapattım ama mesajlar gitmeye devam etti" durumu oluşurdu.
        if (!safe.Enabled && (await GetProgressAsync(ct)).IsRunning)
            await CancelAsync("ayarlardan kapatıldı", ct);

        return safe;
    }

    /// <summary>Admin'in yanlış değer girip sistemi kilitlemesini engelleyen sınırlar.</summary>
    private static BirthdaySettingsDto Sanitize(BirthdaySettingsDto d) => d with
    {
        SendHour = Math.Clamp(d.SendHour, 0, 23),
        SendMinute = Math.Clamp(d.SendMinute, 0, 59),
        ThrottleMilliseconds = Math.Clamp(d.ThrottleMilliseconds, 0, 60_000),
        BatchSize = Math.Clamp(d.BatchSize, 0, 10_000),
        BatchPauseMilliseconds = Math.Clamp(d.BatchPauseMilliseconds, 0, 300_000),
        MaxPerRun = Math.Max(0, d.MaxPerRun),
        MinAge = Math.Clamp(d.MinAge, 0, 120),
        MaxAge = Math.Clamp(d.MaxAge, 0, 120),
        SmsBody = string.IsNullOrWhiteSpace(d.SmsBody) ? new BirthdaySettingsDto().SmsBody : d.SmsBody.Trim(),
        PushTitle = string.IsNullOrWhiteSpace(d.PushTitle) ? new BirthdaySettingsDto().PushTitle : d.PushTitle.Trim(),
        PushBody = string.IsNullOrWhiteSpace(d.PushBody) ? new BirthdaySettingsDto().PushBody : d.PushBody.Trim(),
    };

    public async Task<IReadOnlyList<BirthdayPreviewItemDto>> PreviewAsync(CancellationToken ct)
    {
        var settings = await GetSettingsAsync(ct);
        var today = TurkeyTime.Today();
        var people = await FindBirthdayPeopleAsync(today, settings, ct);

        return people.Select(p => new BirthdayPreviewItemDto(
            p.Id,
            p.FullName,
            MaskPhone(p.Phone),
            CalculateAge(p.BirthDate, today),
            settings.SmsEnabled && !string.IsNullOrWhiteSpace(p.Phone),
            settings.PushEnabled)).ToList();
    }

    public async Task<BirthdayRunResultDto> RunAsync(bool dryRun, bool force, CancellationToken ct)
    {
        var settings = await GetSettingsAsync(ct);

        if (!settings.Enabled && !force)
            return new BirthdayRunResultDto(0, 0, 0, 0, 0, dryRun, "Otomatik doğum günü gönderimi kapalı.");

        var today = TurkeyTime.Today();

        if (!force && !dryRun)
        {
            // Saat geldi mi? (job saat başı tetiklenir, gönderim yalnızca ayarlanan saatte yapılır)
            if (!IsSendTime(TurkeyTime.Now(), settings))
                return new BirthdayRunResultDto(0, 0, 0, 0, 0, dryRun, "Gönderim saati henüz gelmedi.");

            // Bugün zaten gönderildiyse tekrar gönderme
            if (await AlreadySentTodayAsync(today, ct))
                return new BirthdayRunResultDto(0, 0, 0, 0, 0, dryRun, "Bugünkü gönderim zaten yapılmış.");
        }

        var people = await FindBirthdayPeopleAsync(today, settings, ct);
        if (settings.MaxPerRun > 0 && people.Count > settings.MaxPerRun)
            people = people.Take(settings.MaxPerRun).ToList();

        if (dryRun)
            return new BirthdayRunResultDto(people.Count, 0, 0, 0, 0, true, "Deneme çalıştırması — mesaj gönderilmedi.");

        // Aynı anda ikinci bir gönderim başlatılmasın (admin "Şimdi gönder"e iki kez basarsa).
        var mevcut = await GetProgressAsync(ct);
        if (mevcut.IsRunning)
            return new BirthdayRunResultDto(0, 0, 0, 0, 0, false,
                $"Halihazırda bir gönderim sürüyor ({mevcut.Pending} mesaj bekliyor). Önce onu bitirin veya iptal edin.");

        await SetProgressAsync(
            new BirthdayProgress("running", people.Count, 0, 0, 0, 0, TurkeyTime.Now(), null, null), ct);

        int smsSent = 0, pushSent = 0, inApp = 0, skipped = 0, index = 0;
        var cancelled = false;

        foreach (var person in people)
        {
            // İPTAL KONTROLÜ — her kişiden ÖNCE. Admin "İptal" derse kalan liste hiç gönderilmez.
            // Redis'ten okunur: iptal isteği BAŞKA bir API instance'ına düşmüş olabilir.
            if ((await GetProgressAsync(ct)).State == "cancelling")
            {
                cancelled = true;
                break;
            }

            if (ct.IsCancellationRequested)
            {
                cancelled = true;
                break;
            }

            var age = CalculateAge(person.BirthDate, today);
            var smsText = Render(settings.SmsBody, person, age);
            var pushTitle = Render(settings.PushTitle, person, age);
            var pushText = Render(settings.PushBody, person, age);
            var sentAny = false;

            if (settings.SmsEnabled && !string.IsNullOrWhiteSpace(person.Phone))
            {
                try
                {
                    if (await sms.SendOneAsync(person.Phone!, smsText, ct)) { smsSent++; sentAny = true; }
                }
                catch (Exception ex)
                {
                    // Tek kişide hata tüm günün gönderimini durdurmasın.
                    logger.LogWarning(ex, "Doğum günü SMS gönderilemedi (participant {Id})", person.Id);
                }
            }

            if (settings.PushEnabled)
            {
                try
                {
                    await push.SendToParticipantAsync(person.Id, pushTitle, pushText,
                        new Dictionary<string, string> { ["type"] = NotificationType }, ct);
                    pushSent++; sentAny = true;
                }
                catch (Exception ex)
                {
                    logger.LogWarning(ex, "Doğum günü push gönderilemedi (participant {Id})", person.Id);
                }
            }

            if (settings.InAppEnabled)
            {
                await uow.Notifications.AddAsync(
                    Notification.Create(person.Id, pushTitle, pushText, NotificationType), ct);
                inApp++; sentAny = true;
            }

            if (!sentAny) skipped++;

            index++;
            var anlik = await GetProgressAsync(ct);
            await SetProgressAsync(
                anlik with { Processed = index, SmsSent = smsSent, PushSent = pushSent, InAppCreated = inApp }, ct);

            await ThrottleAsync(settings, index, people.Count, ct);
        }

        if (inApp > 0) await uow.SaveChangesAsync(ct);

        // İptal edilmişse "bugün gönderildi" işareti KONMAZ; böylece sorun giderilince
        // admin aynı gün yeniden çalıştırabilir.
        if (!cancelled) await MarkSentTodayAsync(today, ct);

        var finalState = cancelled ? "cancelled" : "completed";
        var son = await GetProgressAsync(ct);
        await SetProgressAsync(son with { State = finalState, FinishedAt = TurkeyTime.Now() }, ct);

        var kalan = Math.Max(people.Count - index, 0);
        logger.LogInformation(
            "Doğum günü kutlaması: {Count} kişi, {Sms} SMS, {Push} push, {InApp} bildirim, iptal={Cancelled}, gönderilmeyen={Kalan}",
            people.Count, smsSent, pushSent, inApp, cancelled, kalan);

        var mesaj = cancelled
            ? $"Gönderim iptal edildi. {index} kişiye gönderildi, {kalan} mesaj gönderilmedi."
            : null;

        return new BirthdayRunResultDto(people.Count, smsSent, pushSent, inApp, skipped, false, mesaj);
    }

    /// <summary>
    /// ACİL DURDURMA (kill switch): devam eden gönderimi iptal eder — kalan liste gönderilmez.
    /// Döngü her kişiden önce bu bayrağı kontrol ettiği için iptal anında etkili olur
    /// (en fazla o an işlenen tek kişi tamamlanır).
    /// </summary>
    public async Task<BirthdayCancelResultDto> CancelAsync(string? cancelledBy, CancellationToken ct)
    {
        var p = await GetProgressAsync(ct);
        if (!p.IsRunning)
            return new BirthdayCancelResultDto(false, 0, "Şu anda süren bir gönderim yok.");

        var pending = p.Pending;
        await SetProgressAsync(p with { State = "cancelling", CancelledBy = cancelledBy }, ct);
        logger.LogWarning("Doğum günü gönderimi iptal edildi ({By}) — {Pending} mesaj gönderilmeyecek",
            cancelledBy ?? "bilinmiyor", pending);
        return new BirthdayCancelResultDto(true, pending,
            $"Gönderim durduruluyor. Gönderilmeyi bekleyen {pending} mesaj iptal edildi.");
    }

    /// <summary>
    /// Canlı durum + "gönderilmeyi bekleyen X mesaj var" uyarısı.
    /// </summary>
    public async Task<BirthdayStatusDto> GetStatusAsync(CancellationToken ct)
    {
        var p = await GetProgressAsync(ct);
        var settings = await GetSettingsAsync(ct);
        var today = TurkeyTime.Today();
        var sentToday = await AlreadySentTodayAsync(today, ct);

        // Bugün kaç kişinin doğum günü var (gönderim sürmüyorsa bilgi amaçlı gösterilir)
        var candidates = p.IsRunning ? p.Total : (await FindBirthdayPeopleAsync(today, settings, ct)).Count;

        var warning = BuildWarning(p, settings, sentToday, candidates);

        return new BirthdayStatusDto
        {
            State = p.State,
            IsRunning = p.IsRunning,
            Total = p.Total,
            Processed = p.Processed,
            Pending = p.Pending,
            SmsSent = p.SmsSent,
            PushSent = p.PushSent,
            InAppCreated = p.InAppCreated,
            StartedAt = p.StartedAt,
            FinishedAt = p.FinishedAt,
            CancelledBy = p.CancelledBy,
            Warning = warning,
            AutoSendEnabled = settings.Enabled,
            SentToday = sentToday,
            TodayCandidates = candidates,
        };
    }

    private static string? BuildWarning(BirthdayProgress p, BirthdaySettingsDto settings, bool sentToday, int candidates)
        => BuildWarningText(p.State, p.Processed, p.Total, p.Pending, settings, sentToday, candidates);

    /// <summary>
    /// Admin ekranında gösterilecek hazır uyarı metni. Kullanıcı isteği: "listede gönderilmeyi
    /// bekleyen mesajlar var der ekrana kaç adet mesaj olduğu uyarısı verebilir."
    /// Saf metot — test edilebilir olması için ayrıldı.
    /// </summary>
    internal static string? BuildWarningText(
        string state, int processed, int total, int pending,
        BirthdaySettingsDto settings, bool sentToday, int candidates)
    {
        if (state == "cancelling")
            return $"Gönderim durduruluyor — {pending} mesaj gönderilmeyecek.";

        if (state == "running")
            return $"Gönderim sürüyor: {processed}/{total} tamamlandı, gönderilmeyi bekleyen {pending} mesaj var.";

        if (state == "cancelled")
            return $"Son gönderim iptal edildi — {pending} mesaj gönderilmedi.";

        if (!settings.Enabled)
            return candidates > 0
                ? $"Otomatik gönderim KAPALI. Bugün doğum günü olan {candidates} kişiye mesaj gitmeyecek."
                : "Otomatik gönderim kapalı.";

        if (sentToday) return null;

        return candidates > 0
            ? $"Bugün doğum günü olan {candidates} kişiye saat {settings.SendHour:00}:{settings.SendMinute:00}'da mesaj gönderilecek."
            : null;
    }

    /// <summary>
    /// Gönderim saati geldi mi? Job saat başı tetiklendiği için yalnızca ayarlanan saatte,
    /// ayarlanan dakikadan sonra gönderim yapılır. (Saat 10:00 ayarlıysa 10:00-10:59 arası
    /// tetiklenen ilk çalıştırma gönderir; ikinci kez göndermemesini mükerrer koruma sağlar.)
    /// </summary>
    internal static bool IsSendTime(DateTime now, BirthdaySettingsDto settings)
        => now.Hour == settings.SendHour && now.Minute >= settings.SendMinute;

    /// <summary>
    /// Kademeli gönderim: her kişi arasında kısa bekleme, her partiden sonra daha uzun mola.
    /// Son kişiden sonra beklemez.
    /// </summary>
    private static async Task ThrottleAsync(BirthdaySettingsDto s, int index, int total, CancellationToken ct)
    {
        if (index >= total) return;

        if (s.BatchSize > 0 && index % s.BatchSize == 0 && s.BatchPauseMilliseconds > 0)
            await Task.Delay(s.BatchPauseMilliseconds, ct);
        else if (s.ThrottleMilliseconds > 0)
            await Task.Delay(s.ThrottleMilliseconds, ct);
    }

    private async Task<List<Participant>> FindBirthdayPeopleAsync(DateOnly today, BirthdaySettingsDto settings, CancellationToken ct)
    {
        // 29 Şubat doğumlular: artık olmayan yıllarda 28 Şubat'ta kutlanır.
        var month = today.Month;
        var day = today.Day;
        var leapFallback = month == 2 && day == 28 && !DateTime.IsLeapYear(today.Year);

        var people = await uow.Participants.FindAsync(
            p => !p.IsDeleted
                 && p.Status == Domain.Enums.ParticipantStatus.Active
                 && (p.BirthDate.Month == month && p.BirthDate.Day == day
                     || leapFallback && p.BirthDate.Month == 2 && p.BirthDate.Day == 29),
            ct);

        if (settings.MinAge > 0 || settings.MaxAge > 0)
        {
            people = people.Where(p =>
            {
                var age = CalculateAge(p.BirthDate, today);
                if (settings.MinAge > 0 && age < settings.MinAge) return false;
                if (settings.MaxAge > 0 && age > settings.MaxAge) return false;
                return true;
            }).ToList();
        }

        return people.OrderBy(p => p.Id).ToList();
    }

    internal static int CalculateAge(DateTime birthDate, DateOnly today)
    {
        var age = today.Year - birthDate.Year;
        var hadBirthday = birthDate.Month < today.Month
                          || birthDate.Month == today.Month && birthDate.Day <= today.Day;
        if (!hadBirthday) age--;
        return Math.Max(age, 0);
    }

    /// <summary>Metindeki {{ad}} {{soyad}} {{adsoyad}} {{yas}} değişkenlerini kişiye göre doldurur.</summary>
    internal static string Render(string template, Participant p, int age)
    {
        var parts = (p.FullName ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var first = parts.Length > 0 ? string.Join(' ', parts[..^1]) : "";
        var last = parts.Length > 0 ? parts[^1] : "";
        if (parts.Length == 1) { first = parts[0]; last = ""; }

        return template
            .Replace("{{adsoyad}}", p.FullName ?? "", StringComparison.OrdinalIgnoreCase)
            .Replace("{{ad}}", first, StringComparison.OrdinalIgnoreCase)
            .Replace("{{soyad}}", last, StringComparison.OrdinalIgnoreCase)
            .Replace("{{yas}}", age.ToString(), StringComparison.OrdinalIgnoreCase)
            .Trim();
    }

    internal static string? MaskPhone(string? phone)
        => string.IsNullOrWhiteSpace(phone) || phone.Length < 4
            ? phone
            : new string('*', phone.Length - 4) + phone[^4..];

    private async Task<bool> AlreadySentTodayAsync(DateOnly today, CancellationToken ct)
    {
        var record = await uow.ModuleNotificationSettings.GetByModuleAsync(StateModule, ct);
        return record is not null && record.ConfigJson.Contains(today.ToString("yyyy-MM-dd"), StringComparison.Ordinal);
    }

    private async Task MarkSentTodayAsync(DateOnly today, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(new { lastRunDate = today.ToString("yyyy-MM-dd") }, JsonOpts);
        var record = await uow.ModuleNotificationSettings.GetByModuleAsync(StateModule, ct);
        if (record is null)
        {
            record = ModuleNotificationSettings.Create(StateModule, json);
            await uow.ModuleNotificationSettings.AddAsync(record, ct);
        }
        else
        {
            record.Update(json);
            uow.ModuleNotificationSettings.Update(record);
        }
        await uow.SaveChangesAsync(ct);
    }
}
