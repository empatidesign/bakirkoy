using System.Security.Cryptography;

namespace Nexora.Domain.Common;

// ULAK-04: vatandaş başvurusu takip numarası TEK kaynaktan üretilir. Milisaniye damgası + 4 haneli
// kriptografik rastgele son ek → saniye çözünürlüklü eski muhtar biçiminin (aynı saniyede eşzamanlı
// başvuruda TrackingNo unique index çakışması) yerine tüm kanallarda (mobil/muhtar/saha) ortak, çakışmaya
// dayanıklı biçim. Çok nadir DB çakışmasına karşı çağıran katman sınırlı yeniden üretim uygulayabilir.
public static class SubmissionTrackingNo
{
    public static string Generate()
    {
        var ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var suffix = RandomNumberGenerator.GetInt32(0, 10000).ToString("D4");
        return $"SUB-{ms}-{suffix}";
    }
}
