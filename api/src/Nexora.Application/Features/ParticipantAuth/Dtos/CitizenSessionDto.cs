namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenSessionDto(
    string SessionId,
    string DeviceType,
    string? IpAddress,
    DateTime CreatedAt,
    bool IsCurrent);
