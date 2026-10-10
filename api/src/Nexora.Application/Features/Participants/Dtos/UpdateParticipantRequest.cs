namespace Nexora.Application.Features.Participants.Dtos;

public record UpdateParticipantRequest(
    string? Phone,
    string? Email,
    string? GuardianPhone,
    string? GuardianEmail,
    bool? IsActive = null);
