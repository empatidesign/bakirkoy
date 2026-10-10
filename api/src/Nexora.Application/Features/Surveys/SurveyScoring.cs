using Nexora.Domain.Entities.Surveys;

namespace Nexora.Application.Features.Surveys;

/// <summary>
/// Anket cevaplarının 0-1 aralığına normalize edilmesi. SurveyService içindeki
/// (test edilmiş) private kopya ile aynı kuralları uygular; platform analitiği
/// (SurveyPlatformService) bu paylaşılan sürümü kullanır.
/// </summary>
public static class SurveyScoring
{
    /// <summary>0-1 aralığında normalize skor; sayısallaştırılamayan tipler için null.</summary>
    public static double? Normalize(SurveyQuestion? question, string rawAnswer)
    {
        if (question is null || string.IsNullOrWhiteSpace(rawAnswer)) return null;

        switch (question.Type)
        {
            case "rating":
            {
                var max = question.RatingCount ?? 5;
                return int.TryParse(rawAnswer, out var v) && max > 0 ? Math.Clamp((double)v / max, 0, 1) : null;
            }
            case "emoji_rating":
                return int.TryParse(rawAnswer, out var e) ? Math.Clamp((e - 1) / 4.0, 0, 1) : null;
            case "satisfaction":
            case "agreement":
                return int.TryParse(rawAnswer, out var s) ? Math.Clamp((s - 1) / 4.0, 0, 1) : null;
            case "scale":
            {
                var min = question.ScaleMin ?? 1;
                var max = question.ScaleMax ?? 10;
                if (max <= min) return null;
                return int.TryParse(rawAnswer, out var v) ? Math.Clamp((double)(v - min) / (max - min), 0, 1) : null;
            }
            case "yes_no":
                return rawAnswer.Trim().Equals("Evet", StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;
            case "like_dislike":
                return rawAnswer.Trim().Equals("Beğendim", StringComparison.OrdinalIgnoreCase) ? 1.0 : 0.0;
            default:
                return null;
        }
    }
}
