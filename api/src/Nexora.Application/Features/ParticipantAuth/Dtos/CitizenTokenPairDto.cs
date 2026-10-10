namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenTokenPairDto(string AccessToken, string RefreshToken, DateTime ExpiresAt, CitizenUserDto User, CitizenSessionConfigDto SessionConfig);
