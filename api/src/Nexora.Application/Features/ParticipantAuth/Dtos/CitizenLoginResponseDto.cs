namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenLoginResponseDto(bool RequiresOtp, string OtpSessionToken, string OtpChannel, string MaskedTarget, int ResendCooldownSeconds);
