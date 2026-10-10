namespace Nexora.Application.Features.Quizzes.Dtos;

public record QuizAgeGroupDto(
    Guid Id,
    string Name,
    int MinAge,
    int MaxAge,
    int SortOrder,
    int QuizCount,
    bool IsActive
);

public record QuizAgeGroupOptionDto(Guid Id, string Name, int MinAge, int MaxAge);

public record QuizAgeGroupSummaryDto(int Total, int Active, int Passive);

public record QuizAgeGroupListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateQuizAgeGroupRequest(string Name, int MinAge, int MaxAge, int SortOrder);

public record UpdateQuizAgeGroupRequest(string Name, int MinAge, int MaxAge, int SortOrder);
