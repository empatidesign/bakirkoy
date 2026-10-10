namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenSessionConfigDto(int WebInactivityTimeoutMinutes, int MobileInactivityTimeoutMinutes);
