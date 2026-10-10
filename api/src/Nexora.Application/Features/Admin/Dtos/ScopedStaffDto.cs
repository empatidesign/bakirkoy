namespace Nexora.Application.Features.Admin.Dtos;

public record ScopedStaffDto(
    Guid AdminUserId,
    string FullName,
    string Email,
    string RoleKey,
    string RoleName,
    Guid ScopeNodeId,
    string? TemporaryPassword = null
);
