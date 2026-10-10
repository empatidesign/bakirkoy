namespace Nexora.Application.Features.Auth.Dtos;

public record VerifyOtpRequest(string OtpSessionToken, string Code);
