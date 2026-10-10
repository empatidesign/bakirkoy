using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Surveys;

/// <summary>
/// SultanŞehir Anket Platformu — 01 nolu doküman §6: kota yönetimi.
/// Bir anket için mahalle / yaş aralığı / cinsiyet kırılımında minimum hedef
/// katılım tanımı. Gerçekleşme SurveyResponse üzerinden canlı hesaplanır.
/// </summary>
public class SurveyQuota : BaseEntity
{
    public Guid SurveyId { get; private set; }
    /// <summary>neighborhood | age_group | gender</summary>
    public string Dimension { get; private set; } = "neighborhood";
    /// <summary>Boyut değeri: "Cebeci", "18-24", "female" gibi.</summary>
    public string Value { get; private set; } = "";
    public int TargetCount { get; private set; }

    public static SurveyQuota Create(Guid surveyId, string dimension, string value, int targetCount)
        => new()
        {
            SurveyId = surveyId,
            Dimension = dimension.Trim(),
            Value = value.Trim(),
            TargetCount = targetCount < 0 ? 0 : targetCount,
        };
}
