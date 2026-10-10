namespace Nexora.Application.Features.EmergencyAreas.Dtos;

public record EmergencyAreaListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Neighborhood { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
