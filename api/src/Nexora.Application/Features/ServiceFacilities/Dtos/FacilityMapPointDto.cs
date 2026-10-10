namespace Nexora.Application.Features.ServiceFacilities.Dtos;

public record FacilityMapPointDto(
    Guid Id,
    string Name,
    string Type,
    string Status,
    string LocationType,
    string District,
    string City,
    double? Latitude,
    double? Longitude,
    int ServiceCount,
    string? PrimaryImageUrl);
