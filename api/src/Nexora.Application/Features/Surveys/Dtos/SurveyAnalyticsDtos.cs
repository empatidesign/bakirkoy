namespace Nexora.Application.Features.Surveys.Dtos;

public record SurveyAnswerDistributionDto(string Label, int Count, double Percentage);

// Kullanıcı isteği (2026-09-03): "her soru(da) katılımcıların raporları olacak detaylı bir
// şekilde hangi soruya hangi mahalle ne cevap vermiş, her soruyu detaylı analiz raporu da
// versin." Bu DTO tek bir sorunun TEK BİR MAHALLE için cevap dağılımını taşır; böylece
// admin "Temizlik sorusuna Cumhuriyet Mahallesi ne cevap verdi" gibi kırılımları görebilir.
public record SurveyQuestionNeighborhoodBreakdownDto(
    string Neighborhood,
    int TotalAnswers,
    double? AverageScore,
    List<SurveyAnswerDistributionDto> Distribution,
    // Kullanıcı isteği (2026-09-03): mahalle karşılaştırma grafiği için 0-100 arası normalize
    // memnuniyet skoru (soru tipi ne olursa olsun tek ölçek). Skorlanamayan sorularda null.
    double? PositivityScore
);

public record SurveyQuestionAnalyticsDto(
    Guid QuestionId,
    int Order,
    string Question,
    string Type,
    int TotalAnswers,
    double? AverageScore,
    List<SurveyAnswerDistributionDto> Distribution,
    List<string>? TextSamples,
    // Kullanıcı isteği (2026-09-03): her sorunun mahalle bazlı kırılımı — hangi mahalle bu
    // soruya hangi dağılımda cevap vermiş. Cevabında mahalle bilgisi olan yanıtlardan
    // hesaplanır; mahallesiz yanıtlar bu kırılıma girmez (yalnızca genel Distribution'da).
    List<SurveyQuestionNeighborhoodBreakdownDto> NeighborhoodBreakdown,
    // Kullanıcı isteği (2026-09-03): "her sorunun genel ortalamasını ve sorun tespiti olsun,
    // bunu da global anket değerlendirme kıstaslarına göre olsun." Sayısal/ikili sorularda
    // 0-100 arası bir OLUMLULUK skoru hesaplanır (memnuniyet/CSAT ölçeği); bu skora göre bir
    // duyarlılık seviyesi (kritik/zayıf/orta/iyi/çok iyi) ve otomatik sorun tespiti üretilir.
    // Serbest metin / seçmeli (skorlanamayan) sorularda null döner.
    SurveyQuestionAssessmentDto? Assessment
);

// Global anket değerlendirme kıstasları (yaygın CSAT/memnuniyet eşikleri):
//   < %40   => kritik (ciddi sorun)
//   %40-55  => zayıf   (sorun var)
//   %55-70  => orta    (iyileştirme gerekir)
//   %70-85  => iyi
//   >= %85  => çok iyi
// IssueDetected, skor %55'in altındaysa (zayıf/kritik) true olur; yönetici bu soruları
// öncelikli ele almalıdır.
public record SurveyQuestionAssessmentDto(
    double PositivityScore,   // 0-100
    string Level,             // critical | weak | moderate | good | excellent
    string LevelLabel,        // Türkçe etiket
    bool IssueDetected,
    string Summary            // yöneticiye tek cümle özet + öneri
);

public record SurveyDemographicsDto(
    List<SurveyAnswerDistributionDto> AgeGroups,
    List<SurveyAnswerDistributionDto> Genders
);

public record SurveyAnalyticsDto(
    Guid SurveyId,
    string SurveyTitle,
    int TotalResponses,
    double CompletionRate,
    double AverageRating,
    double AverageDuration,
    bool IsAnonymous,
    List<SurveyQuestionAnalyticsDto> Questions,
    SurveyDemographicsDto? Demographics
);
