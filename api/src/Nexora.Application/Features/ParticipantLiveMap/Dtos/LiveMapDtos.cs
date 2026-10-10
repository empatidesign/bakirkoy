namespace Nexora.Application.Features.ParticipantLiveMap.Dtos;

public enum LiveMapPointType
{
    EmergencyArea,
    Facility,
    Event,
    Library,
}

public record LiveMapPointDto(
    string Id,
    LiveMapPointType Type,
    string Title,
    string? Subtitle,
    double Latitude,
    double Longitude,
    string? CategoryColor,
    DateTime? When,
    string? DetailRoute,
    bool HasParking = false,
    int? ParkingCapacity = null,
    string? ParkingType = null
);

public record LiveMapResultDto(
    List<LiveMapPointDto> Points
);
