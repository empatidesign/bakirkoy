namespace Nexora.Application.Features.Libraries.Dtos;

public record LibraryRuleDto(
    Guid Id,
    string Category,
    string Title,
    string Description,
    string Icon,
    string Severity,
    bool IsActive);

public record LibraryRuleRequest(
    string Category,
    string Title,
    string Description,
    string Icon,
    string Severity,
    string? LibraryId);

public record LibraryRuleSummaryDto(int Total, int Active, int Passive);

public record LibraryRuleListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Category { get; init; }
    public string? Severity { get; init; }
    public string? LibraryId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
