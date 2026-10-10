namespace Nexora.Application.Features.ParticipantEmergencyAreas.Dtos;

public record CitizenEmergencyAreaDto(
    Guid Id,
    string Name,
    string? Neighborhood,
    string? Address,
    double? Latitude,
    double? Longitude,
    int Capacity,
    int AreaSizeM2,
    string? EmergencyPhone,
    bool Toilet,
    bool Water,
    bool Electricity,
    bool Generator,
    bool Heating,
    bool TentArea
);
