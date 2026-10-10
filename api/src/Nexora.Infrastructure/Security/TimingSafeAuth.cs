namespace Nexora.Infrastructure.Security;

/// <summary>
/// Kullanıcı keşfi zamanlama saldırılarını (User Enumeration via Timing Attack) önlemek için
/// kimlik doğrulama yardımcısı. Kullanıcı veritabanında bulunamadığında da (~150ms) sabit
/// sürede BCrypt doğrulaması çalıştırarak sistemde kimlerin kayıtlı olduğunu sızdırmaz.
/// </summary>
public static class TimingSafeAuth
{
    private static readonly Lazy<string> LazyDummyHash = new(() =>
        BCrypt.Net.BCrypt.HashPassword("nexora_timing_safety_dummy_hash_token", 11));

    public static string DummyHash => LazyDummyHash.Value;

    /// <summary>
    /// SORUN (2026-09-23, kullanıcı bulgusu: "şifre doğru ama giriş yapamıyorum").
    /// Türkçe karakter içeren şifreler (ş, ğ, ı, İ, ö, ü, ç) Unicode'da İKİ farklı
    /// biçimde kodlanabilir: NFC (tek kod noktası) veya NFD (taban harf + birleşik
    /// aksan). Görünüş birebir aynıdır ama bayt dizisi farklıdır; BCrypt baytlar
    /// üzerinde çalıştığı için doğrulama başarısız olur.
    ///
    /// Ölçülen kanıt: "Şifre123" NFC'de 8, NFD'de 9 kod noktasıdır; NFC ile
    /// üretilen hash NFD girdiyi DOĞRULAMAZ (false).
    ///
    /// Bu gerçek bir canlı senaryodur: macOS dosya/klavye katmanları ve bazı
    /// Android/iOS klavyeleri ile şifre yöneticileri NFD üretebilirken web formu
    /// NFC gönderebilir. Yani kullanıcı şifresini bir cihazda belirleyip başka bir
    /// cihazda giremez ve "TC veya şifre hatalı" görür.
    ///
    /// Çözüm: hash üretimi ve doğrulama TEK bir biçime (NFC) indirgenir.
    /// ÖNEMLİ: Normalize yalnızca görsel olarak aynı olan dizileri birleştirir,
    /// farklı şifreleri asla eşitlemez; güvenliği zayıflatmaz.
    ///
    /// Geriye dönük uyumluluk: NFD ile kaydedilmiş ESKİ hash'ler için doğrulama
    /// NFC başarısız olursa ham girdiyle bir kez daha denenir. Böylece eski
    /// kullanıcılar kilitlenmez; yeni hash'ler her zaman NFC üretilir.
    /// </summary>
    public static string NormalizePassword(string password)
        => password.Normalize(System.Text.NormalizationForm.FormC);

    /// <summary>
    /// Şifre hash'lemenin TEK giriş noktası. Doğrudan BCrypt.HashPassword çağırmak
    /// yerine bu kullanılmalıdır; aksi hâlde normalize edilmemiş bir hash üretilir
    /// ve kullanıcı başka bir cihazdan giremez.
    /// </summary>
    public static string HashPassword(string password)
        => BCrypt.Net.BCrypt.HashPassword(NormalizePassword(password));

    public static bool Verify(string? providedPassword, string? actualHash)
    {
        if (string.IsNullOrEmpty(providedPassword))
            return false;

        if (string.IsNullOrEmpty(actualHash))
        {
            BCrypt.Net.BCrypt.Verify(NormalizePassword(providedPassword), DummyHash);
            return false;
        }

        if (BCrypt.Net.BCrypt.Verify(NormalizePassword(providedPassword), actualHash))
            return true;

        // Eski (normalize edilmemiş) hash'ler için geri uyumluluk denemesi.
        // Normalize edilmiş biçim ham girdiyle aynıysa tekrar denemenin anlamı yok.
        var raw = providedPassword;
        if (NormalizePassword(raw) == raw)
            return false;

        return BCrypt.Net.BCrypt.Verify(raw, actualHash);
    }
}
