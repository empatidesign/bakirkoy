using System.Text.RegularExpressions;
using Nexora.Application.Features.CitizenSubmissions;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-28): başvuru içeriği analiz edilip ilgili müdürlüğe yönlendirilsin.
/// Dışa bağımlılık istemediğimiz (offline, deterministik, denetlenebilir olması gereken) bir
/// akış olduğu için LLM yerine ağırlıklı anahtar kelime skorlaması kullanıyoruz:
///  - Türkçe metin normalize edilir (küçük harf + aksan sadeleştirme) ki "AYDINLATMA",
///    "aydinlatma", "Aydınlatma" aynı şekilde eşleşsin.
///  - Her kategori için anahtar kelime listesi vardır; başlıkta geçen kelime 2 kat ağırlıklıdır
///    (başlık, açıklamadan daha bilgi yoğun).
///  - En yüksek skorlu kategori seçilir; skor yoksa vatandaşın seçtiği kategori korunur ve
///    güven skoru 0 olarak işaretlenir (operatör manuel bakmalı).
/// Güven skoru = kazananın payı / toplam skor, 0.5 tabanla normalize edilir.
/// </summary>
public partial class SubmissionContentAnalyzer : ISubmissionContentAnalyzer
{
    private static readonly Dictionary<string, string[]> CategoryKeywords = new()
    {
        ["road"] = ["yol", "asfalt", "cukur", "kaldirim cokmesi", "bozuk yol", "kaplama", "yol coktu", "kasis"],
        ["sidewalk"] = ["kaldirim", "tretuvar", "parke tas", "bordur", "yaya yolu", "engelli rampa"],
        ["park_garden"] = ["park", "bahce", "yesil alan", "agac", "cocuk parki", "oyun grubu", "banklar", "cim", "budama"],
        ["infrastructure"] = ["su", "kanalizasyon", "logar", "rogar", "su basmasi", "iski", "su kacagi", "gider", "tikanik", "altyapi"],
        ["cleaning"] = ["cop", "temizlik", "moloz", "supurme", "konteyner", "atik", "koku", "hafriyat", "cop kutusu"],
        ["lighting"] = ["aydinlatma", "lamba", "sokak lambasi", "elektrik direk", "isik yanmiyor", "karanlik"],
        ["traffic"] = ["trafik", "levha", "hiz kesici", "park sorunu", "otopark", "yaya gecidi", "trafik isigi", "kavsak"],
        ["stray_animal"] = ["sokak hayvani", "kopek", "kedi", "besleme", "kuduz", "hayvan", "veteriner", "sahipsiz"],
        ["noise"] = ["gurultu", "ses", "muzik", "cevre kirliligi", "duman", "bagirma", "rahatsiz"],
        ["building"] = ["ruhsatsiz", "kacak yapi", "insaat", "bina", "imar", "iskan", "metruk", "tadilat"],
    };

    /// <summary>
    /// Kişiye yönelik referans göstergeleri. Bunlar tespit edilirse kayıt muhtara açık içerikle
    /// gösterilmez (yalnızca kategori/konu düzeyinde görünür) ve doğrudan Ulakbel'e iletilir.
    /// </summary>
    private static readonly string[] PersonReferenceHints =
    [
        "komsu", "komsum", "esnaf", "isletme", "kirici", "kiraci", "ev sahibi", "apartman yoneticisi",
        "yonetici", "bay ", "bayan ", "kisi", "sahis", "muhtar", "mudur", "gorevli", "personel",
        "isimli", "adli", "adinda", "beyefendi", "hanimefendi", "isyeri sahibi",
    ];

    /// <summary>
    /// "Ad Soyad" adayı: iki ardışık büyük harfle başlayan kelime. Eşleşmenin HEMEN ARDINDAN
    /// gelen kelime de yakalanır ki "Yunus Emre Mahallesi" gibi üç kelimeli yer adlarında
    /// üçüncü kelimeye bakıp kişi olmadığına karar verebilelim.
    /// </summary>
    [GeneratedRegex(@"\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}(\s+[\wçğıöşüÇĞİÖŞÜ]+)?")]
    private static partial Regex FullNamePattern();

    /// <summary>
    /// "Ad Soyad" kalıbına benzeyen ama kişi OLMAYAN yer/kurum ifadeleri. Canlı testte
    /// "Cebeci Mahallesi", "Fen İşleri" gibi ifadeler kişi adı sanılıp kaydın içeriği muhtardan
    /// gizleniyordu; ikinci kelimesi bu listede olan eşleşmeler kişi sayılmaz.
    /// </summary>
    private static readonly string[] PlaceWordSuffixes =
    [
        "mahallesi", "mahalle", "sokak", "sokagi", "caddesi", "cadde", "bulvari", "meydani",
        "parki", "bahcesi", "muduru", "mudurlugu", "belediyesi", "baskanligi", "camii",
        "okulu", "hastanesi", "durak", "duragi", "koprusu", "yolu", "apartmani", "sitesi",
        "isleri", "ilcesi", "ili", "merkezi", "tesisi", "kutuphanesi", "pazari", "carsisi",
    ];

    public SubmissionAnalysisResult Analyze(string title, string description, string? fallbackCategoryId, string submissionType)
    {
        var rawText = $"{title} {description}";
        var normTitle = Normalize(title);
        var normDesc = Normalize(description);

        var scores = new Dictionary<string, double>();
        var matched = new List<string>();

        foreach (var (categoryId, keywords) in CategoryKeywords)
        {
            double score = 0;
            foreach (var kw in keywords)
            {
                if (ContainsKeyword(normTitle, kw))
                {
                    score += 2;
                    matched.Add(kw);
                }
                else if (ContainsKeyword(normDesc, kw))
                {
                    score += 1;
                    matched.Add(kw);
                }
            }
            if (score > 0) scores[categoryId] = score;
        }

        var containsPerson = DetectPersonReference(rawText, normTitle + " " + normDesc, submissionType);

        if (scores.Count == 0)
        {
            var fallback = string.IsNullOrWhiteSpace(fallbackCategoryId) ? "other" : fallbackCategoryId;
            return new SubmissionAnalysisResult(
                fallback,
                MuhtarlikReference.UlakbelUnitFor(fallback),
                0,
                [],
                containsPerson,
                "Metinde belirgin bir konu anahtar kelimesi bulunamadı; vatandaşın seçtiği kategori kullanıldı.");
        }

        var best = scores.OrderByDescending(x => x.Value).First();
        var total = scores.Values.Sum();
        var confidence = Math.Min(1, 0.5 + (best.Value / total) * 0.5);
        var unit = MuhtarlikReference.UlakbelUnitFor(best.Key);

        var summary = $"\"{MuhtarlikReference.CategoryLabel(best.Key)}\" konusu tespit edildi → {unit}"
            + (containsPerson ? " (metinde kişiye yönelik ifade tespit edildi, kimlik gizli tutulur)" : "");

        return new SubmissionAnalysisResult(
            best.Key,
            unit,
            confidence,
            matched.Distinct().ToList(),
            containsPerson,
            summary);
    }

    private static bool DetectPersonReference(string rawText, string normalized, string submissionType)
    {
        if (PersonReferenceHints.Any(h => normalized.Contains(h, StringComparison.Ordinal)))
            return true;

        // "Ahmet Yılmaz" gibi iki ardışık büyük harfle başlayan kelime = muhtemel kişi adı.
        // Başlık cümle başı büyük harfle başlayabildiği için tek kelime yeterli sayılmaz.
        // "Cebeci Mahallesi" gibi yer adlarını elemek için ikinci kelime kontrol edilir.
        foreach (Match m in FullNamePattern().Matches(rawText))
        {
            var parts = m.Value.Split([' ', '\t', '\n'], StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) continue;

            // "Ad Soyad" adayının ardından gelen kelimelerden herhangi biri yer/kurum eki ise
            // ("Cebeci Mahallesi", "Yunus Emre Mahallesi", "Fen İşleri Müdürlüğü") bu bir kişi
            // adı değildir. Sondaki noktalama temizlenir ("Mahallesi," gibi).
            var isPlace = parts
                .Skip(1)
                .Select(p => Normalize(p.Trim('.', ',', ';', ':', '!', '?', ')', '(')))
                .Any(PlaceWordSuffixes.Contains);
            if (isPlace) continue;

            return true;
        }

        return false;
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): metindeki muhtemel kişi adlarını (DetectPersonReference
    /// ile AYNI regex/yer-adı-eleme mantığını kullanarak) *** ile değiştirir. Yalnızca
    /// eşleşen "Ad Soyad" adayları maskelenir; kalan metin (konu, adres dışı ayrıntılar)
    /// olduğu gibi kalır. Regex FullNamePattern() eşleşmesindeki isteğe bağlı 3. kelime grubu
    /// da (varsa) maskelenir çünkü genelde soyadın devamı ya da orta isimdir.
    /// </summary>
    public string MaskPersonNames(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text;

        return FullNamePattern().Replace(text, m =>
        {
            var parts = m.Value.Split([' ', '\t', '\n'], StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) return m.Value; // tek kelime eşleşmesi zaten olmaz ama savunmacı

            var isPlace = parts
                .Skip(1)
                .Select(p => Normalize(p.Trim('.', ',', ';', ':', '!', '?', ')', '(')))
                .Any(PlaceWordSuffixes.Contains);
            if (isPlace) return m.Value; // yer/kurum adı — dokunma

            return "***";
        });
    }

    /// <summary>Türkçe küçük harf + aksan sadeleştirme (ı/i, ğ/g, ü/u, ş/s, ö/o, ç/c).</summary>
    /// <summary>
    /// Hata bulgusu (2026-09-02): anahtar kelimeler düz Contains ile aranıyordu; "su"
    /// anahtar kelimesi "başvurusu", "kusurlu", "masrafı" gibi ALAKASIZ kelimelerin içinde
    /// eşleşip kaydı yanlışlıkla "Alt Yapı (Su/Kanal)" sayıyor ve İSKİ'ye yönlendiriyordu.
    /// Aynı sorun "ses"→"seslendi", "gider"→"giderek" gibi kısa kelimelerde de vardı.
    ///
    /// Artık eşleşme KELİME SINIRINA saygı duyar: anahtar kelimenin solunda ve sağında
    /// harf/rakam bulunmamalıdır. Türkçe ekler kelimenin SONUNA geldiği için ("yol" →
    /// "yolda") sağ tarafta ek serbest bırakılır; kelimenin BAŞINA rastgele harf eklenmesi
    /// ise kabul edilmez. Çok kelimeli anahtarlar ("bozuk yol") aynı kuralla çalışır.
    /// </summary>
    private static bool ContainsKeyword(string haystack, string keyword)
    {
        var start = 0;
        while (start <= haystack.Length - keyword.Length)
        {
            var idx = haystack.IndexOf(keyword, start, StringComparison.Ordinal);
            if (idx < 0) return false;

            var leftOk = idx == 0 || !char.IsLetterOrDigit(haystack[idx - 1]);
            if (leftOk) return true;

            start = idx + 1;
        }
        return false;
    }

    private static string Normalize(string input)
    {
        var lower = input.ToLowerInvariant();
        var sb = new System.Text.StringBuilder(lower.Length);
        foreach (var ch in lower)
        {
            sb.Append(ch switch
            {
                'ı' or 'i' or 'î' => 'i',
                'ğ' => 'g',
                'ü' or 'û' => 'u',
                'ş' => 's',
                'ö' => 'o',
                'ç' => 'c',
                'â' => 'a',
                _ => ch,
            });
        }
        return sb.ToString();
    }
}
