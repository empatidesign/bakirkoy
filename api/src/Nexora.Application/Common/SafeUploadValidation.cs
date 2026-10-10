using Nexora.Application.Common.Exceptions;

namespace Nexora.Application.Common;

// Vatandaş tarafından yüklenen dosyalar (evrak, profil fotoğrafı vb.) için minimum güvenlik
// süzgeci. COM-DOC-002 canlı testte kanıtlandı: hiçbir uzantı/tip kontrolü yokken bir .exe
// dosyası "Sağlık Raporu" evrakı olarak kabul edilip başvuruyu onaylatabiliyordu.
// Bu, tehlikeli/yürütülebilir dosya uzantılarını REDDEDEN bir kara liste + MIME tip eşleşme
// kontrolüdür (beyaz liste değil — modüller arası çok çeşitli belge türü olduğundan kara liste
// daha az kırılgan). Boyut sınırı zaten Kestrel:MaxRequestBodyBytes ile global uygulanıyor.
public static class SafeUploadValidation
{
    // Tüm sunucu-taraflı yorumlanabilir/yürütülebilir uzantılar burada tek noktada
    // toplanır. FileEndpoints.ActiveContentExtensions de bu listeden türetilir (bkz. #5b) —
    // iki liste birbirinden drift etmesin diye tek kaynak burasıdır.
    public static readonly IReadOnlySet<string> DangerousExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".dll", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".vbs", ".vbe",
        ".js", ".jse", ".wsf", ".wsh", ".jar", ".app", ".sh", ".bin", ".apk", ".deb",
        ".rpm", ".dmg", ".pkg", ".cpl", ".gadget", ".hta", ".msc", ".reg", ".lnk", ".php",
        ".asp", ".aspx", ".jsp", ".py", ".rb", ".pl",
        // 2026-08-26 denetiminde eklendi (#5): yaygın PHP handler uzantıları — pek çok
        // Apache/nginx-php-fpm konfigürasyonunda .php ile aynı şekilde yürütülür ve
        // uzantı kara listesini bypass etmek için sıkça kullanılır.
        ".phtml", ".pht", ".php3", ".php4", ".php5", ".php7", ".phar", ".cgi",
        // 2026-07-30 denetiminde eklendi: bu uzantılar tarayıcıda doğrudan render
        // edilebilir aktif içerik (HTML/SVG içinde <script> çalıştırılabilir) taşıyabilir
        // ve stored XSS'e yol açar. FileEndpoints.StreamObject artık bunları ayrıca
        // Content-Disposition: attachment ile indiriyor ama en güvenli savunma katmanı
        // yüklemeyi baştan reddetmek (defense in depth).
        ".html", ".htm", ".shtml", ".xhtml", ".mjs",
    };

    private static readonly HashSet<string> DangerousContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/x-msdownload", "application/x-msdos-program", "application/x-executable",
        "application/x-sh", "application/x-bat", "application/vnd.microsoft.portable-executable",
        "application/java-archive", "application/vnd.android.package-archive",
    };

    public static void EnsureSafeDocument(string fileName, string? contentType)
    {
        var ext = Path.GetExtension(fileName);
        if (!string.IsNullOrEmpty(ext) && DangerousExtensions.Contains(ext))
            throw new ConflictException($"Bu dosya türü ({ext}) güvenlik nedeniyle yüklenemez.", "UNSAFE_FILE_TYPE");

        if (!string.IsNullOrWhiteSpace(contentType) && DangerousContentTypes.Contains(contentType))
            throw new ConflictException("Bu dosya türü güvenlik nedeniyle yüklenemez.", "UNSAFE_FILE_TYPE");

        // Çift uzantı koruması (örn. "rapor.pdf.exe") — sondaki uzantı tehlikeli olmasa bile
        // dosya adında tehlikeli bir uzantı geçiyorsa reddet.
        var lower = fileName.ToLowerInvariant();
        foreach (var dangerous in DangerousExtensions)
        {
            if (lower.Contains(dangerous + "."))
                throw new ConflictException("Bu dosya adı güvenlik nedeniyle kabul edilemez (çift uzantı şüphesi).", "UNSAFE_FILE_TYPE");
        }
    }
}
