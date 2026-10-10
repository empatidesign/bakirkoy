namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenVerifyResetOtpRequest(string Identifier, string OtpCode);
