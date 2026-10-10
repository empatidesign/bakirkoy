namespace Nexora.Application.Features.Surveys.Dtos;

// Admin panelde "anketlere verilen cevapların kişilerin cevaplarını görmek" özelliği için:
// tek tek her katılımcının anketi nasıl cevapladığını gösteren DTO'lar.
// Anket ANONİM ise gerçek kimlik (isim/TC) hiçbir koşulda dönülmez — sadece stabil, kimliksiz bir
// "Anonim #XXXXXX" etiketi üretilir (bkz. SurveyService.ToResponseDto).

public record SurveyResponseAnswerDto(
    Guid QuestionId,
    string QuestionText,
    string QuestionType,
    string? RawAnswer,
    string AnswerDisplay
);

public record SurveyResponseListItemDto(
    Guid Id,
    Guid SurveyId,
    bool IsAnonymous,
    string? ResponderName,
    string? ResponderTcLast4,
    string? AnonymousLabel,
    DateTime SubmittedAt,
    int AnsweredQuestionCount,
    int TotalQuestionCount,
    List<SurveyResponseAnswerDto> Answers
);

public record SurveyResponseListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 20;
}
