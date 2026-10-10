namespace Nexora.Application.Features.Surveys.Dtos;

public record SurveyDto(
    Guid Id,
    string Title,
    string Description,
    string Category,
    string TargetAudience,
    DateTime? StartDate,
    DateTime? EndDate,
    int EstimatedDuration,
    string Status,
    bool IsActive,
    bool IsAnonymous,
    bool AllowMultipleResponses,
    bool ShowResults,
    bool AutoSendAfterEvent,
    bool SendReminderSMS,
    string? SourceType,
    Guid? SourceId,
    bool IsRequired,
    // --- SultanŞehir Anket Platformu alanları ---
    string SurveyType,
    string IdentityMode,
    string? Topic,
    List<string> TargetNeighborhoods,
    int TargetResponseCount,
    bool FieldEnabled,
    bool RequireLocation,
    int QuestionCount,
    int TotalResponses,
    double? AverageRating,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record SurveyMonthlyResponseDto(string Month, int Responses);

public record SurveyCategoryCountDto(string Category, int Count);

public record SurveySatisfactionTrendDto(string Period, double Satisfaction);

public record SurveyRecentActivityDto(Guid Id, string Title, int TotalResponses, DateTime CreatedAt);

public record SurveySummaryDto(
    int Total,
    int Active,
    int Passive,
    int Draft,
    int Completed,
    int TotalResponses,
    double AverageRating,
    double AverageCompletionRate,
    List<SurveyMonthlyResponseDto> MonthlyResponses,
    List<SurveyCategoryCountDto> CategoryDistribution,
    List<SurveySatisfactionTrendDto> SatisfactionTrends,
    List<SurveyRecentActivityDto> Recent
);

public record SurveyListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? Category { get; init; }
    public bool? IsActive { get; init; }
    public bool? ActiveWindowOnly { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    // SultanŞehir platformu filtreleri
    public string? SurveyType { get; init; }
    public string? Topic { get; init; }
    public string? Neighborhood { get; init; }
    public bool? FieldEnabled { get; init; }
    // Kullanıcı isteği (2026-09-01): "Anket Kullanıcısı" yetkisinde SurveyOwnSurveysOnly
    // açıksa yalnızca kendi oluşturduğu anketler listelenir (SurveyService bu filtreyi
    // çağıranın kimliğine göre otomatik doldurur; frontend bunu doğrudan set etmez).
    public string? CreatedByFilter { get; init; }
}

public record CreateSurveyRequest(
    string Title,
    string Description,
    string Category,
    string TargetAudience,
    DateTime? StartDate,
    DateTime? EndDate,
    int EstimatedDuration,
    bool IsActive,
    bool IsAnonymous,
    bool AllowMultipleResponses,
    bool ShowResults,
    bool AutoSendAfterEvent,
    bool SendReminderSMS,
    string? SourceType,
    Guid? SourceId,
    bool IsRequired,
    List<SurveyQuestionRequest> Questions,
    // --- SultanŞehir Anket Platformu alanları (opsiyonel; eski istemciler etkilenmez) ---
    string? SurveyType = null,
    string? IdentityMode = null,
    string? Topic = null,
    List<string>? TargetNeighborhoods = null,
    int TargetResponseCount = 0,
    bool FieldEnabled = false,
    bool RequireLocation = false
);

public record UpdateSurveyRequest(
    string Title,
    string Description,
    string Category,
    string TargetAudience,
    DateTime? StartDate,
    DateTime? EndDate,
    int EstimatedDuration,
    bool IsActive,
    bool IsAnonymous,
    bool AllowMultipleResponses,
    bool ShowResults,
    bool AutoSendAfterEvent,
    bool SendReminderSMS,
    string? SourceType,
    Guid? SourceId,
    bool IsRequired,
    List<SurveyQuestionRequest> Questions,
    // --- SultanŞehir Anket Platformu alanları (opsiyonel; eski istemciler etkilenmez) ---
    string? SurveyType = null,
    string? IdentityMode = null,
    string? Topic = null,
    List<string>? TargetNeighborhoods = null,
    int TargetResponseCount = 0,
    bool FieldEnabled = false,
    bool RequireLocation = false
);

/// <summary>
/// Kullanıcı isteği (2026-09-01): anket silme, ankete verilmiş tüm yanıtları da yok ettiği
/// için tek tıkla yapılamamalı. Yönetici, silme kutusuna tam onay metnini yazmak zorundadır.
/// Beklenen metin <see cref="SurveyDeleteRules.ConfirmationPhrase"/> ile sabittir.
/// </summary>
public record SurveyDeleteRequest(string Confirmation);

/// <summary>Silmeden önce gösterilen etki özeti — kaç veri kaybolacağını yöneticiye bildirir.</summary>
public record SurveyDeleteImpactDto(
    Guid SurveyId,
    string Title,
    int ResponseCount,
    int QuestionCount,
    int FieldTaskCount,
    bool CanDelete,
    string ConfirmationPhrase);

public static class SurveyDeleteRules
{
    /// <summary>Yöneticinin silme onayı için birebir yazması gereken metin.</summary>
    public const string ConfirmationPhrase = "silmek istiyorum";

    public static bool IsConfirmed(string? input)
        => string.Equals((input ?? "").Trim(), ConfirmationPhrase, StringComparison.OrdinalIgnoreCase);
}
