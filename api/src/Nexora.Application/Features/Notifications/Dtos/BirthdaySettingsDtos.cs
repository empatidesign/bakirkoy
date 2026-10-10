namespace Nexora.Application.Features.Notifications.Dtos;

/// <summary>
/// Kullanıcı isteği (2026-09-07): doğum günü olan vatandaşlara her gün belirlenen saatte
/// (varsayılan 10:00) otomatik kutlama gönderilmesi — kayıtlı cep telefonuna SMS ve/veya
/// mobil uygulamaya push bildirimi, kişiye özel (adıyla). Ayarların tamamı admin panelinden
/// düzenlenebilir; hiçbir değer koda gömülü değildir.
///
/// Saklama: ayrı tablo açılmadı — mevcut <c>ModuleNotificationSettings</c> tablosunda
/// <c>module = "birthday"</c> anahtarıyla tek satır olarak tutulur (Quiz/Anket/Çark/Muhtarlık
/// modüllerindeki paylaşımlı ayar deseninin aynısı).
/// </summary>
public record BirthdaySettingsDto
{
    /// <summary>Otomatik gönderim açık mı? Kapalıysa job hiçbir şey göndermez.</summary>
    public bool Enabled { get; init; } = true;

    /// <summary>Gönderim saati (0-23), Türkiye yerel saati. Varsayılan 10 = sabah 10:00.</summary>
    public int SendHour { get; init; } = 10;

    /// <summary>Gönderim dakikası (0-59).</summary>
    public int SendMinute { get; init; }

    /// <summary>Kayıtlı cep telefonuna SMS gönderilsin mi?</summary>
    public bool SmsEnabled { get; init; } = true;

    /// <summary>Mobil uygulamaya push bildirimi gönderilsin mi?</summary>
    public bool PushEnabled { get; init; } = true;

    /// <summary>Uygulama içi bildirim kutusuna da düşsün mü?</summary>
    public bool InAppEnabled { get; init; } = true;

    /// <summary>SMS metni. Değişkenler: {{ad}}, {{soyad}}, {{adsoyad}}, {{yas}}.</summary>
    public string SmsBody { get; init; } =
        "Sayın {{adsoyad}}, doğum gününüzü kutlar, sağlıklı ve mutlu bir yıl dileriz. Bakırköy Belediyesi";

    /// <summary>Push/uygulama içi bildirim başlığı.</summary>
    public string PushTitle { get; init; } = "İyi ki doğdunuz!";

    /// <summary>Push/uygulama içi bildirim metni. Aynı değişkenleri destekler.</summary>
    public string PushBody { get; init; } =
        "Sayın {{adsoyad}}, doğum gününüzü kutlarız! Nice mutlu yıllar dileriz.";

    /// <summary>
    /// Her kişi arasındaki bekleme (milisaniye). Binlerce kişinin aynı gün doğum günü olduğunda
    /// SMS sağlayıcısını ve sistemi tıkamamak için kademeli gönderim sağlar.
    /// Varsayılan 200 ms ≈ saniyede 5 kişi.
    /// </summary>
    public int ThrottleMilliseconds { get; init; } = 200;

    /// <summary>Kaç kişide bir daha uzun mola verileceği. 0 = parti molası kapalı.</summary>
    public int BatchSize { get; init; } = 50;

    /// <summary>Her partiden sonra verilecek ek bekleme (milisaniye).</summary>
    public int BatchPauseMilliseconds { get; init; } = 2000;

    /// <summary>Tek çalıştırmada gönderilecek azami kişi sayısı (güvenlik sınırı). 0 = sınırsız.</summary>
    public int MaxPerRun { get; init; }

    /// <summary>Bu yaşın altındakilere gönderme (0 = sınır yok). Örn. 18 → çocuklara gitmez.</summary>
    public int MinAge { get; init; }

    /// <summary>Bu yaşın üstündekilere gönderme (0 = sınır yok).</summary>
    public int MaxAge { get; init; }
}

/// <summary>Doğum günü işinin bir çalıştırma sonucu.</summary>
public record BirthdayRunResultDto(
    int Candidates,
    int SmsSent,
    int PushSent,
    int InAppCreated,
    int Skipped,
    bool DryRun,
    string? Message = null);

/// <summary>
/// Kullanıcı isteği (2026-09-07): "yanlış gönderim olmaması için gerektiğinde kapat dediğimizde
/// tüm liste iptal edilebilsin, ekranda kaç mesaj beklediği uyarısı çıksın."
/// Bu DTO admin panelin canlı durum kutusunu besler.
/// </summary>
public record BirthdayStatusDto
{
    /// <summary>idle | running | cancelling | cancelled | completed</summary>
    public string State { get; init; } = "idle";

    /// <summary>Şu an bir gönderim sürüyor mu?</summary>
    public bool IsRunning { get; init; }

    /// <summary>Bu çalıştırmadaki toplam kişi sayısı.</summary>
    public int Total { get; init; }

    /// <summary>Şu ana kadar işlenen kişi sayısı.</summary>
    public int Processed { get; init; }

    /// <summary>GÖNDERİLMEYİ BEKLEYEN mesaj sayısı — ekranda gösterilecek uyarının kaynağı.</summary>
    public int Pending { get; init; }

    public int SmsSent { get; init; }
    public int PushSent { get; init; }
    public int InAppCreated { get; init; }

    /// <summary>Gönderim başlangıcı (Türkiye saati).</summary>
    public DateTime? StartedAt { get; init; }

    /// <summary>Bitiş/iptal zamanı.</summary>
    public DateTime? FinishedAt { get; init; }

    /// <summary>İptal isteyen kullanıcı (varsa).</summary>
    public string? CancelledBy { get; init; }

    /// <summary>Ekranda gösterilecek hazır uyarı metni.</summary>
    public string? Warning { get; init; }

    /// <summary>Otomatik gönderim ayarı açık mı (ayrı bilgi: sürmekte olan işten bağımsız).</summary>
    public bool AutoSendEnabled { get; init; }

    /// <summary>Bugün gönderim yapıldı mı?</summary>
    public bool SentToday { get; init; }

    /// <summary>Bugün doğum günü olan kişi sayısı (gönderim yapılmasa da bilgi amaçlı).</summary>
    public int TodayCandidates { get; init; }
}

/// <summary>İptal isteğinin sonucu.</summary>
public record BirthdayCancelResultDto(
    bool Accepted,
    int PendingAtCancel,
    string Message);

/// <summary>Bugün doğum günü olanların önizlemesi (admin panel için).</summary>
public record BirthdayPreviewItemDto(
    Guid ParticipantId,
    string FullName,
    string? MaskedPhone,
    int Age,
    bool WillGetSms,
    bool WillGetPush);
