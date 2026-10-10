using System.Security.Cryptography;
using System.Text;

namespace Nexora.Infrastructure.Security;

/// <summary>
/// Bulgu (2026-09-22, vatandaş test raporu): "Şifremi unuttum" akışında,
/// bir kullanıcı ESKİ şifreyle giriş yapıp 2FA/OTP ekranında beklerken (OTP
/// oturum tokenı elinde), aynı anda (başka bir sekme/cihazda) şifresini
/// sıfırlarsa, elindeki eski OTP oturum tokenı ile OTP kodunu girip HALA
/// giriş yapabiliyordu — sunucu OTP doğrulama anında şifrenin hâlâ geçerli
/// olup olmadığını yeniden kontrol etmiyordu (bkz. AuthService/CompanyAuthService/
/// ParticipantAuthService VerifyOtpAsync). "Pending OTP" JWT'si yalnızca
/// "bu kullanıcı X dakika önce doğru şifreyi biliyordu" der, "şifre hâlâ bu"
/// demez. Bu, oturum sabitleme (session fixation) tarzı bir açıktı: şifre
/// sıfırlama sonrası eski şifrenin en fazla 10 dakika (pending-OTP TTL)
/// boyunca hâlâ hesaba giriş sağlamasına izin veriyordu.
///
/// Düzeltme: pending-OTP JWT'sine, token üretildiği andaki PasswordHash'in
/// kısa bir parmak izi (fingerprint) gömülür. OTP doğrulanıp gerçek
/// access/refresh token üretilmeden hemen önce, güncel PasswordHash'ten
/// aynı parmak izi tekrar hesaplanıp tokendakiyle karşılaştırılır. Farklıysa
/// (şifre bu süre içinde değiştiyse/sıfırlandıysa) OTP oturumu geçersiz
/// sayılır ve kullanıcı baştan giriş yapmaya zorlanır.
///
/// Parmak izi PasswordHash'in kendisi DEĞİLDİR (JWT payload'ında bcrypt hash
/// taşımak istenmez) — geri döndürülemez kısa bir SHA-256 özeti. Gizli bir
/// sır olarak kullanılmaz (OTP kodu zaten asıl doğrulamadır); yalnızca
/// "şifre bu token üretildiğinden beri değişti mi" sorusunu ucuza yanıtlar.
/// </summary>
public static class PasswordFingerprint
{
    public static string Compute(string? passwordHash)
    {
        if (string.IsNullOrEmpty(passwordHash)) return "";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(passwordHash));
        return Convert.ToHexString(bytes)[..16];
    }
}
