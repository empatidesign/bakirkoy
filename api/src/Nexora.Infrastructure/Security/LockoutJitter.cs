using System.Security.Cryptography;

namespace Nexora.Infrastructure.Security;

/// <summary>
/// Kullanıcı isteği (2026-09-21): "5 hatalı denemede kilitle, ama süre dışarıdan
/// gelen botlar tarafından tahmin edilemesin — 4-5 dakika içinde farklı saniye".
///
/// Sabit bir kilit süresi (ör. tam olarak 60 saniye veya tam olarak 5 dakika)
/// brute-force bir bot için tamamen ölçülebilir bir sinyaldir: bot bir kez
/// kilitlenmeyi tetikler, süreyi kronometreyle ölçer, tam o saniyede otomatik
/// yeniden dener. Rastgele bir jitter eklemek bu tahmini imkansız kılar: her
/// kilitlenmede süre gözlemlenemez şekilde değişir, bot "kesin ne zaman
/// açılacağını" bilemez ve ya çok erken (hâlâ kilitli, deneme boşa gider) ya da
/// gereksiz yere geç dener.
///
/// <see cref="RandomNumberGenerator"/> kullanılır (System.Random DEĞİL) çünkü
/// System.Random öngörülebilir bir PRNG'dir (seed'i zamana bağlıdır) — güvenlik
/// amaçlı bir gecikme için kriptografik olarak güvenli rastgelelik gerekir,
/// aksi halde jitter'ın kendisi de tahmin edilebilir hale gelir.
/// </summary>
public static class LockoutJitter
{
    /// <summary>
    /// [0, maxSeconds] aralığında kriptografik olarak güvenli rastgele bir saniye
    /// değeri döndürür. Varsayılan aralık 0-60 sn: 4 dakikalık taban süreyle
    /// birleşince gerçek kilit süresi 4-5 dakika arasında, her denemede farklı
    /// olur (kullanıcı isteği: "4-5 dakika içinde farklı saniye açalım").
    /// </summary>
    public static int NextSeconds(int maxSeconds = 60)
        => maxSeconds <= 0 ? 0 : RandomNumberGenerator.GetInt32(0, maxSeconds + 1);
}

/// <summary>
/// Ortak "hesabınız kilitlendi" mesajı üretici. Önceki halde her auth servisi
/// (AuthService, ParticipantAuthService) kendi kopyasını tutuyordu; CompanyAuthService
/// ve CompanyStaffAuthService ise gerçek kalan süre yerine sabit "15 dakika sonra"
/// metni yazıyordu — kilit süresi (LockoutSettings'ten) değiştiğinde veya jitter
/// eklendiğinde bu mesaj gerçek durumla çelişiyordu (2026-09-21 denetiminde bulundu).
/// Tek bir yerden üretilerek dört servis de her zaman gerçek kalan süreyi gösterir.
/// </summary>
public static class LockoutMessage
{
    public static string Build(DateTime? lockedUntil)
    {
        if (lockedUntil is null) return "Hesabınız kilitlendi. Lütfen daha sonra tekrar deneyin.";
        var remaining = lockedUntil.Value - DateTime.UtcNow;
        var seconds = Math.Max(1, (int)Math.Ceiling(remaining.TotalSeconds));
        var text = seconds < 60 ? $"{seconds} saniye" : $"{Math.Ceiling(seconds / 60.0):0} dakika";
        return $"Hesabınız kilitlendi. {text} sonra tekrar deneyin.";
    }
}
