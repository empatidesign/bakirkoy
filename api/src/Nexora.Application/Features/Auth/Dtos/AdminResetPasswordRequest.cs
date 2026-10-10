namespace Nexora.Application.Features.Auth.Dtos;

public record AdminVerifyResetOtpRequest(string Identifier, string OtpCode)
{
    public string Value => Identifier ?? "";
}

public record AdminResetPasswordRequest(string Identifier, string OtpCode, string NewPassword)
{
    public string Value => Identifier ?? "";
}
