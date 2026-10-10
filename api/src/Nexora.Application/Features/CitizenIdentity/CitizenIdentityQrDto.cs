namespace Nexora.Application.Features.CitizenIdentity;

public record CitizenIdentityQrDto(string Token, int RotationSeconds, DateTime ExpiresAt, string ShortCode);
