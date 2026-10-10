namespace Nexora.Application.Features.Quizzes.Dtos;

public record QuizCategoryDto(
    Guid Id,
    string Name,
    string? Description,
    string Color,
    Guid? ParentId,
    string? ParentName,
    int QuizCount,
    bool IsActive
);

public record QuizCategoryOptionDto(Guid Id, string Name, Guid? ParentId);

public record QuizCategorySummaryDto(int Total, int Active, int Passive);

public record QuizCategoryListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public Guid? ParentId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateQuizCategoryRequest(string Name, string? Description, string Color, Guid? ParentId);

public record UpdateQuizCategoryRequest(string Name, string? Description, string Color, Guid? ParentId);
