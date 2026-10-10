using System.Globalization;
using System.Text.RegularExpressions;

namespace Nexora.Domain.Common;

public static class BakirkoyNeighborhoods
{
    public static readonly string[] All =
    [
        "Ataköy 1. Kısım", "Ataköy 2-5-6. Kısım", "Ataköy 3-4-11. Kısım", "Ataköy 7-8-9-10. Kısım",
        "Basınköy", "Cevizlik", "Kartaltepe", "Osmaniye", "Sakızağacı", "Şenlik",
        "Yenimahalle", "Yeşilköy", "Yeşilyurt", "Zeytinlik", "Zuhuratbaba",
    ];

    public const string Unknown = "Diğer / Belirsiz";

    /// <summary>
    /// Hata bulgusu (2026-09-02): Anket modülü mahalleyi ek atılmamış, Muhtarlık modülü ise
    /// "Mahallesi" ekiyle kaydediyor. Mahalle analizinde bu ikisi AYRI satır sayılıyor
    /// ve aynı mahallenin anket memnuniyeti ile talep sayısı hiçbir zaman yan yana gelmiyordu
    /// (talebi olan mahallede "anket=0", anketi olan mahallede "talep=0" görünüyordu).
    /// Bu metod sondaki "Mahallesi" ekini atar. Karşılaştırma ve gruplama her zaman
    /// bunun üzerinden yapılmalıdır. (Bilinen yazım farkı eşlemesi gerekmedi: Bakırköy'ün
    /// resmi 15 mahalle adında Sultangazi'deki gibi alternatif yazımlı mahalle çifti yok.)
    /// </summary>

    /// <summary>
    /// Türkçe "İ/ı" harflerini doğru eşleyen kültür. Sunucunun yerel ayarına GÜVENİLMEZ
    /// (CurrentCulture container'da "en-US" olabilir), bu yüzden tr-TR sabit tanımlanır.
    /// </summary>
    private static readonly CultureInfo TurkishCulture = CultureInfo.GetCultureInfo("tr-TR");

    private static bool TrEquals(string a, string b)
        => string.Compare(a, b, TurkishCulture, CompareOptions.IgnoreCase) == 0;

    private static bool TrEndsWith(string value, string suffix)
        => value.Length >= suffix.Length && TrEquals(value[^suffix.Length..], suffix);

    public static string CanonicalName(string? neighborhood)
    {
        if (string.IsNullOrWhiteSpace(neighborhood)) return string.Empty;
        var value = neighborhood.Trim();
        // Hata bulgusu (2026-09-02, birim testi): OrdinalIgnoreCase Türkçe noktalı "İ" ile
        // noktasız "i" harfini EŞ SAYMAZ. Bu yüzden büyük harfle girilen "CEBECİ MAHALLESİ"
        // kaydında ek atılmıyor ve mahalle yine ayrı satır oluyordu. Karşılaştırma Türkçe
        // kültür kuralıyla yapılır.
        const string suffix = "Mahallesi";
        if (value.EndsWith(suffix, StringComparison.InvariantCultureIgnoreCase)
            || TrEndsWith(value, suffix))
            value = value[..^suffix.Length].TrimEnd();
        value = value.Trim();

        return value;
    }

    private static readonly (string Name, Regex[] Patterns)[] Matchers =
    [
        ("Ataköy 1. Kısım", [new Regex(@"atakoy\s*1", RegexOptions.Compiled)]),
        ("Ataköy 2-5-6. Kısım", [new Regex(@"atakoy\s*2", RegexOptions.Compiled)]),
        ("Ataköy 3-4-11. Kısım", [new Regex(@"atakoy\s*3", RegexOptions.Compiled), new Regex(@"atakoy\s*4", RegexOptions.Compiled), new Regex(@"atakoy\s*11", RegexOptions.Compiled)]),
        ("Ataköy 7-8-9-10. Kısım", [new Regex(@"atakoy\s*7", RegexOptions.Compiled), new Regex(@"atakoy\s*8", RegexOptions.Compiled), new Regex(@"atakoy\s*9", RegexOptions.Compiled), new Regex(@"atakoy\s*10", RegexOptions.Compiled)]),
        ("Basınköy", [new Regex(@"basinkoy", RegexOptions.Compiled)]),
        ("Cevizlik", [new Regex(@"cevizlik", RegexOptions.Compiled)]),
        ("Kartaltepe", [new Regex(@"kartaltepe", RegexOptions.Compiled)]),
        ("Osmaniye", [new Regex(@"osmaniye", RegexOptions.Compiled)]),
        ("Sakızağacı", [new Regex(@"sakizagaci", RegexOptions.Compiled)]),
        ("Şenlik", [new Regex(@"senlik", RegexOptions.Compiled), new Regex(@"florya", RegexOptions.Compiled)]),
        ("Yenimahalle", [new Regex(@"yenimahalle", RegexOptions.Compiled)]),
        ("Yeşilköy", [new Regex(@"yesilkoy", RegexOptions.Compiled)]),
        ("Yeşilyurt", [new Regex(@"yesilyurt", RegexOptions.Compiled)]),
        ("Zeytinlik", [new Regex(@"zeytinlik", RegexOptions.Compiled)]),
        ("Zuhuratbaba", [new Regex(@"zuhuratbaba", RegexOptions.Compiled)]),
    ];

    private static string Normalize(string s)
    {
        var chars = new char[s.Length];
        for (var i = 0; i < s.Length; i++)
        {
            chars[i] = s[i] switch
            {
                'İ' or 'I' or 'ı' => 'i',
                'Ğ' or 'ğ' => 'g',
                'Ü' or 'ü' => 'u',
                'Ş' or 'ş' => 's',
                'Ö' or 'ö' => 'o',
                'Ç' or 'ç' => 'c',
                _ => char.ToLowerInvariant(s[i]),
            };
        }
        return new string(chars);
    }

    public static string Classify(string? address)
    {
        if (string.IsNullOrWhiteSpace(address)) return Unknown;
        var norm = Normalize(address);
        foreach (var (name, patterns) in Matchers)
            foreach (var p in patterns)
                if (p.IsMatch(norm))
                    return name;
        return Unknown;
    }
}
