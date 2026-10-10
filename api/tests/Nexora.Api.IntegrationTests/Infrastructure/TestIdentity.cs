namespace Nexora.Api.IntegrationTests.Infrastructure;

// Describes a real admin identity minted directly as a signed JWT for the hosted API.
// The token uses the exact claim shape produced by the production JwtService so the real
// authentication/authorization/permission middleware pipeline runs unchanged.
public sealed record TestIdentity(
    Guid UserId,
    string FullName,
    string Email,
    bool IsSuperAdmin,
    string? RoleName)
{
    // A super admin bypasses per-permission checks (PermissionEnforcementMiddleware), matching
    // the seeded SuperAdmin. Used for create/delete acceptance flows.
    public static TestIdentity SuperAdmin(Guid userId, string email) =>
        new(userId, "Test Süper Admin", email, IsSuperAdmin: true, RoleName: "SuperAdmin");

    // An authenticated admin with a role that holds NO permissions. Reaches the permission
    // middleware and is rejected with 403 FORBIDDEN, exercising the missing-permission envelope.
    public static TestIdentity PermissionlessAdmin(Guid userId, string email) =>
        new(userId, "Yetkisiz Yönetici", email, IsSuperAdmin: false, RoleName: "NoPermissionRole");
}
