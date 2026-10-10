namespace Nexora.Application.Features.Auth.Dtos;

public record TokenPairDto(string AccessToken, string RefreshToken, DateTime ExpiresAt, MeDto User, SessionConfigDto SessionConfig);
