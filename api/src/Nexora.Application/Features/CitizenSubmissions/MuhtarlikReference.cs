using Nexora.Application.Features.CitizenSubmissions.Dtos;

namespace Nexora.Application.Features.CitizenSubmissions;

public static class MuhtarlikReference
{
    public static IReadOnlyList<string> Neighborhoods { get; } =
    [
        "Ataköy 1. Kısım Mahallesi",
        "Ataköy 2-5-6. Kısım Mahallesi",
        "Ataköy 3-4-11. Kısım Mahallesi",
        "Ataköy 7-8-9-10. Kısım Mahallesi",
        "Basınköy Mahallesi",
        "Cevizlik Mahallesi",
        "Kartaltepe Mahallesi",
        "Osmaniye Mahallesi",
        "Sakızağacı Mahallesi",
        "Şenlik Mahallesi",
        "Yenimahalle Mahallesi",
        "Yeşilköy Mahallesi",
        "Yeşilyurt Mahallesi",
        "Zeytinlik Mahallesi",
        "Zuhuratbaba Mahallesi",
    ];

    public static IReadOnlyList<CitizenSubmissionOptionDto> NeighborhoodOptions { get; } =
        Neighborhoods.Select(n => new CitizenSubmissionOptionDto(n, n)).ToList();

    public static Guid NeighborhoodRefId(string neighborhood)
    {
        var normalized = neighborhood.Trim().ToLowerInvariant();
        var bytes = System.Text.Encoding.UTF8.GetBytes($"nexora-muhtarlik-neighborhood:{normalized}");
        var hash = System.Security.Cryptography.MD5.HashData(bytes);
        return new Guid(hash);
    }

    public static string SlugifyForUsername(string input)
    {
        // Bulgu (2026-09-07, kendi kendine gözden geçirme): ToLowerInvariant() Türkçe
        // noktalı büyük İ'yi (U+0130) küçük harfe çevirmiyor (invariant kültürde İ->İ
        // kalır, yalnızca tr-TR kültüründe İ->i olur) — "İsmetpaşa Mahallesi" gibi İ ile
        // başlayan mahalle adlarında slug "muhtar.İsmetpasa@..." gibi büyük harfle
        // üretiliyordu (işlevsel sorun yok, e-posta case-insensitive, ama tutarsız
        // görünüyordu). İ->i dönüşümü lowercase'den ÖNCE elle yapılır.
        var lower = input.Trim().Replace('İ', 'i').ToLowerInvariant()
            .Replace('ı', 'i').Replace('ğ', 'g').Replace('ü', 'u')
            .Replace('ş', 's').Replace('ö', 'o').Replace('ç', 'c');

        var sb = new System.Text.StringBuilder();
        var lastDash = false;
        foreach (var ch in lower)
        {
            if (char.IsLetterOrDigit(ch))
            {
                sb.Append(ch);
                lastDash = false;
            }
            else if (!lastDash && sb.Length > 0)
            {
                sb.Append('-');
                lastDash = true;
            }
        }
        var slug = sb.ToString().Trim('-');
        const string suffix = "-mahallesi";
        return slug.EndsWith(suffix, StringComparison.Ordinal) ? slug[..^suffix.Length] : slug;
    }

    private static readonly Dictionary<string, (string Name, string Phone)> Muhtars = new()
    {
        ["Ataköy 1. Kısım Mahallesi"] = ("Recep Yılmaz", "0532 100 1001"),
        ["Ataköy 2-5-6. Kısım Mahallesi"] = ("Hatice Demir", "0532 100 1002"),
        ["Ataköy 3-4-11. Kısım Mahallesi"] = ("Mustafa Kara", "0532 100 1003"),
        ["Ataköy 7-8-9-10. Kısım Mahallesi"] = ("Ahmet Öztürk", "0532 100 1004"),
        ["Basınköy Mahallesi"] = ("Fatma Çelik", "0532 100 1005"),
        ["Cevizlik Mahallesi"] = ("Hüseyin Şahin", "0532 100 1006"),
        ["Kartaltepe Mahallesi"] = ("Zeynep Polat", "0532 100 1007"),
        ["Osmaniye Mahallesi"] = ("Ali Doğan", "0532 100 1008"),
        ["Sakızağacı Mahallesi"] = ("Ayşe Yıldız", "0532 100 1009"),
        ["Şenlik Mahallesi"] = ("Mehmet Kara", "0532 100 1010"),
        ["Yenimahalle Mahallesi"] = ("Elif Acar", "0532 100 1011"),
        ["Yeşilköy Mahallesi"] = ("Murat Şen", "0532 100 1012"),
        ["Yeşilyurt Mahallesi"] = ("Hatice Aydın", "0532 100 1013"),
        ["Zeytinlik Mahallesi"] = ("Kadir Yılmaz", "0532 100 1014"),
        ["Zuhuratbaba Mahallesi"] = ("Sevgi Demir", "0532 100 1015"),
    };

    public static (string Name, string Phone)? MuhtarFor(string neighborhood)
        => Muhtars.TryGetValue(neighborhood, out var m) ? m : null;

    private static readonly Dictionary<string, (string Label, string UlakbelUnit)> Categories = new()
    {
        ["road"] = ("Bozuk Yol / Asfalt", "Fen İşleri Müdürlüğü"),
        ["sidewalk"] = ("Kaldırım", "Fen İşleri Müdürlüğü"),
        ["park_garden"] = ("Park / Bahçe / Yeşil Alan", "Park ve Bahçeler Müdürlüğü"),
        ["infrastructure"] = ("Alt Yapı (Su / Kanal)", "İSKİ / Fen İşleri"),
        ["cleaning"] = ("Temizlik / Çöp", "Temizlik İşleri Müdürlüğü"),
        ["lighting"] = ("Aydınlatma", "Fen İşleri Müdürlüğü"),
        ["traffic"] = ("Trafik / Levha", "Ulaşım Hizmetleri Müdürlüğü"),
        ["stray_animal"] = ("Sokak Hayvanları", "Veteriner İşleri Müdürlüğü"),
        ["noise"] = ("Gürültü / Çevre Kirliliği", "Çevre Koruma Müdürlüğü"),
        ["building"] = ("Ruhsatsız Yapı / Bina", "İmar ve Şehircilik Müdürlüğü"),
        ["other"] = ("Diğer", "Genel Yazı İşleri Müdürlüğü"),
    };

    public static IReadOnlyList<CitizenSubmissionOptionDto> CategoryOptions { get; } =
        Categories.Select(c => new CitizenSubmissionOptionDto(c.Key, c.Value.Label)).ToList();

    public static string CategoryLabel(string categoryId)
        => Categories.TryGetValue(categoryId, out var c) ? c.Label : categoryId;

    public static string UlakbelUnitFor(string categoryId)
        => Categories.TryGetValue(categoryId, out var c) ? c.UlakbelUnit : "Genel Yazı İşleri Müdürlüğü";

    public static readonly string[] AllowedStatuses = ["new", "in_review", "forwarded", "resolved", "rejected"];
    public static readonly string[] StatusActionAllowed = ["in_review", "resolved", "rejected"];

    public static readonly IReadOnlyList<string> SubmissionTypes = ["request", "suggestion", "complaint"];
    public static readonly IReadOnlyList<string> Priorities = ["low", "normal", "high", "urgent"];

    public static IReadOnlyList<CitizenSubmissionOptionDto> SubmissionTypeOptions { get; } =
        SubmissionTypes.Select(t => new CitizenSubmissionOptionDto(t, SubmissionTypeLabel(t))).ToList();

    public static IReadOnlyList<CitizenSubmissionOptionDto> PriorityOptions { get; } =
        Priorities.Select(p => new CitizenSubmissionOptionDto(p, PriorityLabel(p))).ToList();

    public static string SubmissionTypeLabel(string type) => type switch
    {
        "request" => "Talep",
        "suggestion" => "İstek / Öneri",
        "complaint" => "Şikayet",
        _ => type,
    };

    public static string PriorityLabel(string priority) => priority switch
    {
        "low" => "Düşük",
        "normal" => "Normal",
        "high" => "Yüksek",
        "urgent" => "Acil",
        _ => priority,
    };

    public static string StatusLabel(string status) => status switch
    {
        "new" => "Yeni",
        "in_review" => "İncelemede",
        "forwarded" => "Ulakbel'e İletildi",
        "resolved" => "Çözüldü",
        "rejected" => "Reddedildi",
        _ => status,
    };

    // --- Kullanıcı isteği (2026-08-28) ---

    /// <summary>Başvurunun adresi vatandaşın ikametgahı mı yoksa başka bir yer mi.</summary>
    public static readonly IReadOnlyList<string> AddressTypes = ["residence", "other"];

    public static IReadOnlyList<CitizenSubmissionOptionDto> AddressTypeOptions { get; } =
        [new("residence", "İkametgah adresim"), new("other", "Farklı bir adres / konum")];

    public static string AddressTypeLabel(string type) => type switch
    {
        "residence" => "İkametgah adresi",
        "other" => "Farklı adres",
        _ => type,
    };

    /// <summary>Başvurunun kapsamı: sadece mahalle mi yoksa Bakırköy geneli mi.</summary>
    public static readonly IReadOnlyList<string> Scopes = ["neighborhood", "district"];

    public static IReadOnlyList<CitizenSubmissionOptionDto> ScopeOptions { get; } =
        [new("neighborhood", "Mahallem ile ilgili"), new("district", "Bakırköy geneli")];

    public static string ScopeLabel(string scope) => scope switch
    {
        "neighborhood" => "Mahalle",
        "district" => "Bakırköy geneli",
        _ => scope,
    };

    /// <summary>
    /// Süreç aşaması etiketleri (vatandaş ve muhtar zaman çizelgesinde gösterilir).
    /// </summary>
    public static string EventTypeLabel(string eventType) => eventType switch
    {
        "created" => "Başvuru alındı",
        "analyzed" => "İçerik analiz edildi",
        "auto_forwarded" => "İlgili müdürlüğe otomatik iletildi",
        "in_review" => "İncelemeye alındı",
        "forwarded" => "İlgili müdürlüğe iletildi",
        "info" => "Bilgilendirme",
        "muhtar_note" => "Muhtar görüşü",
        "resolved" => "Çözüldü",
        "rejected" => "Reddedildi",
        _ => eventType,
    };

    /// <summary>
    /// Hedef süreler (saat). Vatandaş ve muhtar ekranında "kaç saatte ne olmalı / ne oldu"
    /// karşılaştırması için kullanılır; gecikme hesabı bu değerlere göre yapılır.
    /// Öncelik yükseldikçe hedef süre kısalır.
    /// </summary>
    public static (int FirstResponseHours, int ResolutionHours) SlaTargetsFor(string priority) => priority switch
    {
        "urgent" => (4, 48),
        "high" => (12, 120),
        "normal" => (24, 240),
        "low" => (48, 480),
        _ => (24, 240),
    };
}
