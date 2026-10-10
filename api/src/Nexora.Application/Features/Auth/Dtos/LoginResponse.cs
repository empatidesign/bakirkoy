namespace Nexora.Application.Features.Auth.Dtos;

public record LoginResponse
{
    public bool RequiresOtp { get; init; }
    public string? OtpSessionToken { get; init; }
    public string? OtpChannel { get; init; }
    public int ResendCooldownSeconds { get; init; }
    public bool HasActiveSessions { get; init; }
    public string? AccessToken { get; init; }
    public string? RefreshToken { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public MeDto? User { get; init; }
    public SessionConfigDto? SessionConfig { get; init; }
}
