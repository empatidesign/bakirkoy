namespace Nexora.Application.Features.Quizzes.Dtos;

public record QuizDto(
    Guid Id,
    string Title,
    string Description,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    Guid CategoryId,
    string CategoryName,
    string? CategoryColor,
    int QuestionCount,
    int PerQuestionTimeLimit,
    int DurationMinutes,
    int ParticipantCount,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? ArchivedAt,
    string? ArchivedBy,
    Guid? AgeGroupId = null,
    string? AgeGroupName = null,
    Guid? SubCategoryId = null,
    string? SubCategoryName = null,
    string? EducationLevel = null,
    int PassingScore = 0,
    bool NegativeMarking = false,
    bool RandomizeQuestions = false,
    bool AllowRetry = false,
    int MaxParticipants = 0,
    int PassRights = 0,
    string? ResidencyMode = null
);

public record QuizOptionDto(string Value, string Label);

public record QuizSummaryDto(
    int Total,
    int Upcoming,
    int Ongoing,
    int Completed,
    int Active,
    int Passive,
    int TotalParticipants,
    int AverageScore
);

public record QuizListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public Guid? CategoryId { get; init; }
    public Guid? AgeGroupId { get; init; }
    public Guid[]? EligibleForAgeGroupIds { get; init; }
    public bool? OnlyAllAges { get; init; }
    public bool? IsActive { get; init; }
    public bool? ActiveWindowOnly { get; init; }
    public bool? Archived { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateQuizRequest(
    Guid CategoryId,
    string Title,
    string Description,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    int QuestionCount,
    int PerQuestionTimeLimit,
    int DurationMinutes,
    Guid? AgeGroupId = null,
    Guid? SubCategoryId = null,
    string? EducationLevel = null,
    int PassingScore = 0,
    bool NegativeMarking = false,
    bool RandomizeQuestions = false,
    bool AllowRetry = false,
    int MaxParticipants = 0,
    int PassRights = 0,
    string? ResidencyMode = null
);

public record UpdateQuizRequest(
    Guid CategoryId,
    string Title,
    string Description,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    int QuestionCount,
    int PerQuestionTimeLimit,
    int DurationMinutes,
    Guid? AgeGroupId = null,
    Guid? SubCategoryId = null,
    string? EducationLevel = null,
    int PassingScore = 0,
    bool NegativeMarking = false,
    bool RandomizeQuestions = false,
    bool AllowRetry = false,
    int MaxParticipants = 0,
    int PassRights = 0,
    string? ResidencyMode = null
);

public record QuizParticipantListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
