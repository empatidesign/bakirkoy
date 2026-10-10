namespace Nexora.Application.Features.Seda.Dtos;

public record SedaSchoolDto(
    Guid Id,
    string Name,
    bool IsActive,
    int ApplicationCount,
    DateTime CreatedAt
);

public record SedaSchoolListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record SedaSchoolFormRequest(string Name);
