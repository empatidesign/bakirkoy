namespace Nexora.Application.Features.Admin.Dtos;

public record AdminSetManualPasswordRequest(string NewPassword, bool MustChangeOnFirstLogin);
