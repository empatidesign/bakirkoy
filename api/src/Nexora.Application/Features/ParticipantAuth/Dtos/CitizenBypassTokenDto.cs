namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenBypassTokenDto(string AccessToken, string RefreshToken, DateTime ExpiresAt, CitizenUserDto User, CitizenSessionConfigDto SessionConfig);
