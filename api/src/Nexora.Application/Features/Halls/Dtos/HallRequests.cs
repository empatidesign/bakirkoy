namespace Nexora.Application.Features.Halls.Dtos;

public record HallListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? FacilityId { get; init; }
    public string? Type { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateHallRequest(
    Guid FacilityId,
    string Name,
    string Type,
    int? BuildingFloor,
    string SeatingMode,
    int Capacity,
    SeatingLayoutDto? Layout,
    List<string> FeatureIds,
    string? Description,
    string? About);

public record SeatPlanRequest(Dictionary<string, string> States);
