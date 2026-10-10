namespace Nexora.Application.Features.Surveys;

/// <summary>
/// Kullanıcı isteği (2026-09-01): "neden biri olumlu diğeri olumsuz veya neden hep olumlu,
/// bunların tamamı konusunda anket sisteminin bir aritmetiği veya fizibilitesi olsun."
///
/// Anketör performansının ve veri güvenilirliğinin açık, denetlenebilir formülleri.
/// Saf fonksiyonlardır (DB/HTTP bağımlılığı yok) — birim testten geçebilir ve rapora
/// aynen yazılabilir.
///
/// Skor tanımları (tümü 0-1 normalize skorlar üzerinden):
///   olumlu  : skor >= 0.60
///   nötr    : 0.40 &lt;= skor &lt; 0.60
///   olumsuz : skor &lt; 0.40
/// </summary>
public static class SurveyPerformanceMath
{
    public const double PositiveThreshold = 0.60;
    public const double NegativeThreshold = 0.40;

    /// <summary>Saha medyanının bu oranından hızlı görüşmeler "şüpheli hızlı" sayılır.</summary>
    public const double FastRatio = 0.40;

    /// <summary>Bu sayıda ve üzeri yanıt neredeyse tek noktadan girilmişse "sahada dolaşmama" şüphesi.</summary>
    public const int SinglePointSuspicionMinResponses = 3;

    /// <summary>
    /// Doğrulama bulgusu (2026-09-01, e2e): sapma eşiği doğrudan standart sapma alındığında,
    /// sahada az sayıda anketör varken (ör. 2 kişi) σ aşırı büyüyor (%53) ve bariz bir sapma
    /// (%37,5 fazla olumlu) "ortalamayla uyumlu" olarak raporlanıyordu. Eşik bu yüzden
    /// 10-25 yüzde puan aralığına sıkıştırılır.
    /// </summary>
    public static double BiasThreshold(double positiveRateStdDev)
        => Math.Clamp(positiveRateStdDev, 10.0, 25.0);

    public static string Sentiment(double normalizedScore) => normalizedScore switch
    {
        >= PositiveThreshold => "positive",
        >= NegativeThreshold => "neutral",
        _ => "negative",
    };

    public static double Median(IReadOnlyList<double> values)
    {
        if (values.Count == 0) return 0;
        var sorted = values.OrderBy(v => v).ToList();
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2.0;
    }

    public static double StdDev(IReadOnlyList<double> values)
    {
        if (values.Count < 2) return 0;
        var mean = values.Average();
        return Math.Sqrt(values.Sum(v => (v - mean) * (v - mean)) / (values.Count - 1));
    }

    public static double Percent(int part, int whole)
        => whole <= 0 ? 0 : Math.Round(100.0 * part / whole, 1);

    /// <summary>
    /// 0-100 veri güvenilirliği. 100'den başlar, her kalite şüphesi puan düşürür:
    ///   - şüpheli hızlı görüşme oranı  : ×0.50 ceza
    ///   - düz çizgi (aynı cevap) oranı : ×0.40 ceza
    ///   - eksik GPS oranı              : ×0.20 ceza
    ///   - işaretlenmiş (flagged) oran  : ×0.60 ceza
    ///   - tek noktadan seri doldurma   : 5+ yanıtta 3'ten az ayrık konum varsa −15
    /// </summary>
    public static double ReliabilityScore(
        double fastRate, double straightLiningRate, double gpsCoverageRate,
        double flaggedRate, int responseCount, int distinctLocationCount)
    {
        var score = 100.0
            - fastRate * 0.50
            - straightLiningRate * 0.40
            - (100.0 - gpsCoverageRate) * 0.20
            - flaggedRate * 0.60;
        if (responseCount >= SinglePointSuspicionMinResponses && distinctLocationCount < 3) score -= 15;
        return Math.Round(Math.Clamp(score, 0, 100), 1);
    }

    /// <summary>
    /// 0-100 genel performans:
    ///   %45 hedefe ulaşma (100%'de tavan)
    ///   %25 veri güvenilirliği
    ///   %15 mahalle/konum kapsaması (5 ayrık konum = tam puan)
    ///   %15 tutarlılık (saha ortalamasından sapmanın tersi: |bias| 30 puanda 0'a iner)
    /// </summary>
    public static double PerformanceScore(
        double progressPercent, double reliabilityScore, int distinctLocationCount, double biasIndex)
    {
        var target = Math.Clamp(progressPercent, 0, 100);
        var coverage = Math.Clamp(distinctLocationCount / 5.0, 0, 1) * 100;
        var consistency = Math.Clamp(100 - Math.Abs(biasIndex) * (100.0 / 30.0), 0, 100);
        return Math.Round(target * 0.45 + reliabilityScore * 0.25 + coverage * 0.15 + consistency * 0.15, 1);
    }

    /// <summary>
    /// "Neden bu anketörün sonuçları böyle?" — sayısal göstergeleri yöneticinin okuyabileceği
    /// Türkçe gerekçelere çevirir. Boş liste = kayda değer bir sapma yok.
    /// </summary>
    public static List<string> Explain(
        int responseCount, double positiveRate, double fieldPositiveRate, double positiveRateStdDev,
        double negativeRate, double fastRate, double straightLiningRate,
        double gpsCoverageRate, int distinctLocationCount, double progressPercent,
        double averageDurationSeconds, double fieldMedianDurationSeconds)
    {
        var notes = new List<string>();
        if (responseCount == 0)
        {
            notes.Add("Henüz yanıt toplamamış — performans yorumu için veri yok.");
            return notes;
        }

        if (responseCount < 10)
            notes.Add($"Yalnızca {responseCount} yanıt var; oranlar istatistiksel olarak zayıf (en az 10 yanıt önerilir).");

        var bias = positiveRate - fieldPositiveRate;
        var threshold = BiasThreshold(positiveRateStdDev);
        if (bias > threshold)
            notes.Add($"Olumlu yanıt oranı saha ortalamasının %{Math.Round(bias, 1)} üzerinde — yönlendirici soru sorma ya da memnun kitleyi seçme eğilimi incelenmeli.");
        else if (bias < -threshold)
            notes.Add($"Olumlu yanıt oranı saha ortalamasının %{Math.Round(-bias, 1)} altında — görüştüğü mahallede gerçek bir memnuniyetsizlik olabilir, mahalle kırılımıyla doğrulanmalı.");
        else
            notes.Add("Olumlu/olumsuz dağılımı saha ortalamasıyla uyumlu.");

        if (negativeRate >= 50)
            notes.Add($"Yanıtların %{Math.Round(negativeRate, 1)}'i olumsuz — bu anketörün çalıştığı mahalle/konu öncelikli gündem adayı.");

        if (fastRate >= 20)
            notes.Add($"Görüşmelerin %{Math.Round(fastRate, 1)}'i saha medyanının çok altında sürede tamamlanmış — aceleye getirilmiş doldurma riski.");
        if (averageDurationSeconds > 0 && fieldMedianDurationSeconds > 0 && averageDurationSeconds > fieldMedianDurationSeconds * 2)
            notes.Add("Ortalama görüşme süresi saha medyanının iki katından uzun — vatandaşla uzun görüşüyor ya da kayıt ekranı açık unutuluyor.");

        if (straightLiningRate >= 20)
            notes.Add($"Yanıtların %{Math.Round(straightLiningRate, 1)}'inde tüm sorulara aynı seçenek verilmiş (düz çizgi) — veri kalitesi şüpheli.");

        if (gpsCoverageRate < 80)
            notes.Add($"Yanıtların yalnızca %{Math.Round(gpsCoverageRate, 1)}'inde konum kaydı var — cihazda GPS izni kapalı olabilir.");
        if (responseCount >= SinglePointSuspicionMinResponses && distinctLocationCount < 3)
            notes.Add("Yanıtların neredeyse tamamı aynı noktadan girilmiş — sahada dolaşmadan doldurma şüphesi.");

        if (progressPercent >= 100)
            notes.Add("Hedefini tamamlamış.");
        else if (progressPercent < 50)
            notes.Add($"Hedefin %{Math.Round(progressPercent, 1)}'ine ulaşabilmiş — kalan sürede tempo artırılmalı.");

        return notes;
    }
}
