namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenGuardianDto(
    Guid Id,
    string FullName,
    string? PhotoUrl,
    string? Relation);
