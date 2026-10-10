using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelRouteListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CategoryId { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record TravelRouteFormRequest(
    string Name,
    Guid CategoryId,
    string Destination,
    double? Latitude,
    double? Longitude,
    string Description,
    string Conditions,
    string InternalNote,
    string Gender,
    int MinAge,
    int MaxAge,
    JsonElement Restrictions,
    JsonElement Images,
    JsonElement Pricing,
    JsonElement Points,
    bool IsActive,
    bool SultangaziResidentOnly,
    string? DeparturePoint = null
);
