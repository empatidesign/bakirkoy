namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenOtpChallengeDto(string OtpChannel, string MaskedTarget, int ResendCooldownSeconds);
