using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelBusListParams
{
    public int? Page { get; init; }
    public int? Limit { get; init; }
    public string? Search { get; init; }
    public Guid? TravelId { get; init; }
    public bool? All { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record TravelBusFormRequest(
    string Name,
    string? PlateNumber,
    string TemplateId,
    JsonElement SeatStates,
    string VehicleType = "bus",
    int? Capacity = null
);
