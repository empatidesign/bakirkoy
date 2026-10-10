namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenMeResponseDto(
    CitizenUserDto User,
    CitizenSessionConfigDto SessionConfig,
    CitizenGuardianDto? Guardian = null);
