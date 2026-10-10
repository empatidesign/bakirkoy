namespace Nexora.Application.Features.Auth.Dtos;

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
