namespace Nexora.Application.Features.EmergencyAreas.Dtos;

public record EmergencyAreaMapPointDto(
    Guid Id,
    string Name,
    string Neighborhood,
    double? Latitude,
    double? Longitude,
    int Capacity,
    string Status);
