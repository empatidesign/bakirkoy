using System.Text.Json;

namespace Nexora.Application.Features.Travels.Dtos;

public record TravelRouteDto(
    Guid Id,
    string Name,
    Guid CategoryId,
    string CategoryName,
    string CategoryColor,
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
    string DeparturePoint,
    int TravelCount,
    int ActiveTravelCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record TravelRouteOptionDto(Guid Id, string Name, string? Destination);
