namespace Nexora.Application.Features.Auth.Dtos;

public record ResendOtpResponse(string OtpSessionToken, string OtpChannel, int ResendCooldownSeconds);
