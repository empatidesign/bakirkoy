namespace Nexora.Application.Features.ParticipantAuth.Dtos;

public record CitizenChangePasswordRequest(string CurrentPassword, string NewPassword);
