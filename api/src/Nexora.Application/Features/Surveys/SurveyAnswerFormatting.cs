using System.Text.Json;
using Nexora.Domain.Entities.Surveys;

namespace Nexora.Application.Features.Surveys;

// SurveyService (admin: bir ankete verilen tüm cevapları listeleme) ile katılımcı detayındaki
// "Anketler" sekmesi (bir kişinin verdiği tüm cevapları listeleme) aynı ham AnswersJson formatını
// ve aynı okunabilir gösterim kurallarını kullanır. Yeni kod bu paylaşılan yardımcıyı kullanır;
// SurveyService.cs'deki mevcut (test edilmiş) private kopya bilinçli olarak dokunulmadan bırakıldı.
public static class SurveyAnswerFormatting
{
    private static readonly string[] SatisfactionLabels = ["Çok Kötü", "Kötü", "Orta", "İyi", "Çok İyi"];
    private static readonly string[] AgreementLabels = ["Kesinlikle Hayır", "Hayır", "Kararsız", "Evet", "Kesinlikle Evet"];
    private static readonly string[] EmojiLabels = ["😢", "😕", "😐", "🙂", "😄"];

    public record RawAnswerJson(Guid QuestionId, string Answer);

    public static List<RawAnswerJson> ParseAnswersJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<RawAnswerJson>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string FormatAnswerDisplay(SurveyQuestion? question, string rawAnswer)
    {
        if (string.IsNullOrWhiteSpace(rawAnswer)) return "(boş)";

        return question?.Type switch
        {
            "checkbox" => string.Join(", ", ParseCheckboxAnswer(rawAnswer)),
            "satisfaction" => LabelFromIndex(rawAnswer, SatisfactionLabels),
            "agreement" => LabelFromIndex(rawAnswer, AgreementLabels),
            "emoji_rating" => EmojiFromIndex(rawAnswer),
            "rating" => int.TryParse(rawAnswer, out var stars) ? $"{stars} / {question.RatingCount ?? 5} ⭐" : rawAnswer,
            "scale" => question.ScaleMin.HasValue && question.ScaleMax.HasValue
                ? $"{rawAnswer} (Ölçek: {question.ScaleMin}-{question.ScaleMax})"
                : rawAnswer,
            _ => rawAnswer,
        };
    }

    // Hata #13: checkbox cevapları eskiden String.Join(",")/Split(',') ile tek string'de
    // saklanıyordu — seçenek metninde virgül olduğunda cevaplar yanlış parçalara bölünüyordu.
    // Yeni gönderimler checkbox cevabını bir JSON string dizisi olarak yollar
    // (["Temizlik, Çevre","Parklar, Bahçeler"]). Burada önce JSON dizisi olarak okumayı deneriz;
    // eski (virgülle ayrılmış düz string) kayıtlar için geriye uyumlu split(',') fallback'ine düşeriz.
    public static List<string> ParseCheckboxAnswer(string rawAnswer)
    {
        if (string.IsNullOrWhiteSpace(rawAnswer)) return [];

        var trimmed = rawAnswer.TrimStart();
        if (trimmed.StartsWith('['))
        {
            try
            {
                var arr = JsonSerializer.Deserialize<List<string>>(rawAnswer);
                if (arr is not null)
                    return arr.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList();
            }
            catch (JsonException)
            {
                // JSON dizisi gibi görünüp bozuksa aşağıdaki eski-format fallback'ine düş.
            }
        }

        return rawAnswer.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }

    private static string LabelFromIndex(string rawAnswer, string[] labels)
        => int.TryParse(rawAnswer, out var idx) && idx >= 1 && idx <= labels.Length ? labels[idx - 1] : rawAnswer;

    private static string EmojiFromIndex(string rawAnswer)
        => int.TryParse(rawAnswer, out var idx) && idx >= 1 && idx <= EmojiLabels.Length ? $"{EmojiLabels[idx - 1]} ({idx}/5)" : rawAnswer;
}
