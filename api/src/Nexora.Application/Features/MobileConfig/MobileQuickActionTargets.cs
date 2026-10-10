using Nexora.Application.Features.MobileConfig.Dtos;

namespace Nexora.Application.Features.MobileConfig;

/// <summary>
/// Uygulamanın tanıdığı hedeflerin tek kaynağı. Panel açılır listesini bundan
/// doldurur ve kayıtta yalnızca buradaki bir hedef kabul edilir.
///
/// Buraya yeni bir hedef eklemek TEK BAŞINA yetmez: istemcideki
/// quickActionTargets eşlemesine de aynı anahtar eklenmelidir. Anahtarı
/// tanımayan (eski sürüm) istemci kartı gizler, uygulama kırılmaz.
/// </summary>
public static class MobileQuickActionTargets
{
    /// <summary>Hedef anahtarı → panelde görünen ad. RequiresUrl olanlar adres ister.</summary>
    public static readonly IReadOnlyList<MobileQuickActionTargetDto> All =
    [
        new("emergency", "Acil Toplanma Alanları", false),
        new("pharmacy", "Nöbetçi Eczaneler", false),
        new("ebelediye", "e-Belediye", false),
        new("cityguide", "Şehir Rehberi", false),
        new("request", "Talep / Şikayet", false),
        new("applications", "Başvurularım", false),
        new("facilities", "Tesisler", false),
        new("events", "Etkinlikler", false),
        new("announcements", "Duyurular", false),
        new("services", "Hizmetler", false),
        new("search", "Hızlı Arama", false),
        new("appointment", "Randevu", false),
        new("points", "Puan & Ödül", false),
        new("reservation", "Rezervasyonlarım", false),
        new("contact", "İletişim Bilgileri", false),
        new("myqr", "QR Kodum", false),
        new("scanqr", "QR Tara", false),
        new("callcenter", "Çağrı Merkezini Ara", false),
        new("phone", "Telefon Numarası Ara", true),
        new("website", "Web Adresi Aç", true),
        new("screen", "Manuel Yönlendirme (ekran adı)", true),
    ];

    private static readonly Dictionary<string, MobileQuickActionTargetDto> ByKey =
        All.ToDictionary(x => x.Target, StringComparer.OrdinalIgnoreCase);

    /// <summary>Hedefin değeri serbest yazılan bir ekran adı mı?</summary>
    public static bool IsManualScreen(string? target)
        => string.Equals(target?.Trim(), "screen", StringComparison.OrdinalIgnoreCase);

    public static bool IsKnown(string? target)
        => !string.IsNullOrWhiteSpace(target) && ByKey.ContainsKey(target.Trim());

    /// <summary>Hedef kendi adresini/numarasını gerektiriyor mu?</summary>
    public static bool RequiresUrl(string? target)
        => !string.IsNullOrWhiteSpace(target)
            && ByKey.TryGetValue(target.Trim(), out var t)
            && t.RequiresUrl;
}
