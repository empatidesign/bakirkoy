namespace Nexora.Application.Features.Seda.Dtos;

public record SedaDefinitionDto(
    Guid Id,
    string Type,
    string Name,
    bool IsActive,
    DateTime CreatedAt
);

public record SedaDefinitionListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Type { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateSedaDefinitionRequest(string Type, string Name);

public record UpdateSedaDefinitionRequest(string Name);
