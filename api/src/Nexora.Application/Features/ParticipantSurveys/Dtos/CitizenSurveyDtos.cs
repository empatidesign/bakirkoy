namespace Nexora.Application.Features.ParticipantSurveys.Dtos;

public record SourceContextDto(
    string Type,
    string Name,
    DateTime SourceStartDate,
    DateTime SourceEndDate,
    string? FacilityName,
    string? HallName,
    string? Destination);

public record CitizenSurveyDto(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string Status,
    bool IsActive,
    bool IsAnonymous,
    int EstimatedDuration,
    int QuestionCount,
    DateTime? StartDate,
    DateTime? EndDate,
    bool AlreadyResponded,
    string? SourceType,
    Guid? SourceId,
    bool IsRequired,
    SourceContextDto? SourceContext);

public record CitizenSurveyListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Category { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CitizenSurveyQuestionDto(
    Guid Id,
    int Order,
    string Type,
    string Question,
    string? Description,
    bool Required,
    List<string> Options,
    int? ScaleMin,
    int? ScaleMax,
    string? MinLabel,
    string? MaxLabel,
    int? RatingCount);

public record CitizenSurveyDetailDto(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string Status,
    bool IsAnonymous,
    int EstimatedDuration,
    DateTime? StartDate,
    DateTime? EndDate,
    bool AlreadyResponded,
    bool IsRequired,
    List<CitizenSurveyQuestionDto> Questions,
    SourceContextDto? SourceContext = null,
    // 2026-09-23 test bulgusu: opsiyonel anket cooldown'u (SURVEY_COOLDOWN_ACTIVE) yalnızca
    // Submit() sırasında ortaya çıkıyordu — vatandaş tüm soruları doldurduktan SONRA hata
    // alıyordu ("bu anketi ilk kez dolduruyorum ama bekleme hatası çıktı" şikayeti aslında
    // cooldown'un başka bir opsiyonel anketten miras kalmasıydı, ki bu kasıtlı davranış
    // (bkz. EnforceOptionalSurveyThrottleAsync yorumu); asıl eksik olan bunu ERKENDEN
    // göstermemekti). Detay ucu artık aynı throttle hesaplamasını submit'e girmeden ÖNCE
    // yapıp sonucu döner ki mobil/portal formu doldurmadan önce uyarabilsin.
    int? CooldownRemainingMinutes = null,
    bool AllowMultipleResponses = false,
    List<CitizenSurveyAnswerDto>? MyAnswers = null);

public record CitizenSurveyAnswerDto(Guid QuestionId, string Answer);

public record CitizenSurveySubmitRequest(List<CitizenSurveyAnswerDto> Answers);

public record CitizenSurveySubmitResultDto(Guid ResponseId, DateTime SubmittedAt);

public record PendingSurveySummaryDto(
    int PendingCount,
    int RequiredPendingCount,
    bool HasRequiredPending,
    IReadOnlyList<PendingSurveyItemDto> Items,
    // Kullanıcı isteği (2026-08-12): "birden fazla program/etkinlik varsa her biri en az 1 saat
    // arayla olsun, art arda rahatsız etmesin" — pacing algoritması. Zorunlu anket birden fazla
    // olsa bile, aynı anda yalnızca EN FAZLA BİRİ bloklayıcı modal olarak sunulmaya uygundur; o
    // da Participant.LastMandatorySurveyPromptAt üzerinden en az SurveySettings:
    // MinMandatoryPromptIntervalMinutes (varsayılan 60dk) geçtiyse. Null ise şu an hiçbir zorunlu
    // anket bloklayıcı gösterilmemeli (henüz interval dolmadı) — vatandaş uygulamayı normal
    // kullanmaya devam eder, bir sonraki uygun anda tekrar sorulur.
    System.Guid? NextEligibleRequiredSurveyId);

public record PendingSurveyItemDto(
    System.Guid Id,
    string Title,
    bool IsRequired,
    string? SourceType,
    string? SourceName);
