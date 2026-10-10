namespace Nexora.Application.Features.CorporateProxy;

/// <summary>
/// Mobil uygulamanın (sultansehir-app) kurumsal API'den kullandığı yolların
/// tam listesi. src/services/belediye.service.ts içinde `get('yol')` biçiminde
/// çağrılan yollarla birebir eşleşir (GUVENLIK-YOL-HARITASI.md'de doğrulandı,
/// 27 yol — tamamı salt-okunur GET).
///
/// Serbest passthrough YAPILMAZ: yalnızca bu listedeki bir yol için istek
/// kurumsal API'ye iletilir. Böylece bu proxy, kurumsal API'nin kendisi
/// genişlese (ör. bir yazma ucu eklense) bile mobil uygulamanın erişimini
/// bugünkü ihtiyacıyla sınırlı tutar — tıpkı madde 1'deki "readonly" scope
/// gibi, ama uç seviyesinde.
/// </summary>
public static class CorporateApiAllowedPaths
{
    public static readonly IReadOnlySet<string> Exact = new HashSet<string>(StringComparer.Ordinal)
    {
        "announcements",
        "app-sliders",
        "directorates",
        "facilities",
        "municipal/contact",
        "municipal/events",
        "municipal/neighborhoods",
        "municipal/popup",
        "municipal/president/contents",
        "municipal/president/gallery",
        "municipal/president/general-information",
        "municipal/references",
        "navigation/banner",
        "navigation/banner-slider",
        "navigation/banners",
        "navigation/fast-menu",
        "navigation/menu",
        "news",
        "organization/chart",
        "organization/council-members",
        "organization/municipal-councils",
        "organization/vice-presidents",
        "projects",
        "services",
        "services/categories",
        "sultangazi/city-guide-categories",
        "sultangazi/city-guides",
    };

    /// <summary>
    /// Sayısal ID ile biten detay yolları (ör. "projects/42", "organization/vice-presidents/7").
    /// Prefix + sadece rakam kontrolü yapılır; "projects/42/delete" gibi bir
    /// yolun sızmasını (prefix eşleşse bile) engeller.
    /// </summary>
    private static readonly string[] NumericIdPrefixes =
    [
        "projects/",
        "organization/vice-presidents/",
        "services/",
    ];

    public static bool IsAllowed(string path)
    {
        var normalized = path.Trim('/');
        if (Exact.Contains(normalized)) return true;

        foreach (var prefix in NumericIdPrefixes)
        {
            if (normalized.Length > prefix.Length
                && normalized.StartsWith(prefix, StringComparison.Ordinal)
                && normalized[prefix.Length..].All(char.IsAsciiDigit))
            {
                return true;
            }
        }

        return false;
    }
}
