namespace Nexora.Application.Features.Roles.Dtos;

public record RoleDto(
    Guid Id,
    string Name,
    string Key,
    string? Description,
    bool IsActive,
    bool IsSystem,
    bool IsSuperAdmin,
    int PermissionCount,
    int AssignedUserCount,
    DateTime CreatedAt,
    string Color
);

public record RoleDetailDto(
    Guid Id,
    string Name,
    string Key,
    string? Description,
    bool IsActive,
    bool IsSystem,
    bool IsSuperAdmin,
    int PermissionCount,
    int AssignedUserCount,
    DateTime CreatedAt,
    string Color,
    List<string> PermissionKeys
);

public record RoleOptionDto(string Key, string Name, string Color, string? FacilityModule = null, bool HasLibraryDoorPermission = false);

public record RoleListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CreateRoleRequest(string Name, string? Description, List<string>? PermissionKeys);

public record UpdateRoleRequest(string Name, string? Description, List<string>? PermissionKeys);
