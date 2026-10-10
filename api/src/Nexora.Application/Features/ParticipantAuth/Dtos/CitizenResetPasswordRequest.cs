namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenResetPasswordRequest(string Identifier, string OtpCode, string NewPassword);
