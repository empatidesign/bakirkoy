namespace Nexora.Application.Features.Participants.Dtos;

public record SetStatusRequest(string Status, string? Reason);

public record SendPasswordResetRequest(string Channel);

public record SetManualPasswordRequest(string NewPassword, bool MustChangeOnFirstLogin);
