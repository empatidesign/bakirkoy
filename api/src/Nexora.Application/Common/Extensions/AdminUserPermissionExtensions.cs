using Nexora.Application.Common.Repositories;

namespace Nexora.Application.Common.Extensions;

// PermissionEnforcementMiddleware.HasPermissionAsync ile aynı sorgu deseni, ama middleware
// dışından (ör. LibraryWebhookService gibi bir HTTP endpoint'i olmayan, cihaz webhook'undan
// tetiklenen bir akıştan) tek bir yetki anahtarını kontrol edebilmek için çıkarıldı. Süper
// admin rolü her zaman true döner (middleware'deki currentUser.IsSuperAdmin kısayoluyla aynı
// semantiği taşımak için Role.IsSuperAdmin kontrol edilir).
public static class AdminUserPermissionExtensions
{
    public static async Task<bool> HasPermissionAsync(this IUnitOfWork uow, Guid adminUserId, string permissionKey, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(adminUserId, ct);
        if (user is null || !user.IsActive) return false;

        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        if (role is null || !role.IsActive) return false;
        if (role.IsSuperAdmin) return true;

        var permissionIds = await uow.RolePermissions.GetPermissionIdsByRoleAsync(user.RoleId, ct);
        if (permissionIds.Count == 0) return false;

        var permissions = await uow.Permissions.GetByIdsAsync(permissionIds, ct);
        return permissions.Any(p => p.Key == permissionKey);
    }

    // Kullanıcı isteği (2026-10-04): "toplu sms gönderme yetkisinin kimde olacağı
    // tanımlanmalı — kişilere veya yetki gruplarında". Rol bazlı HasPermissionAsync'in
    // üzerine, bireysel kullanıcıya özel istisnayı (AdminPermissions, effect=allow/deny)
    // ekler — SurveyPlatformService.EnsurePermissionAsync'teki ile aynı öncelik sırası:
    // kullanıcıya özel override varsa rol izninden BAĞIMSIZ olarak o geçerlidir (deny,
    // rolde izin olsa bile engeller; allow, rolde izin olmasa bile açar).
    public static async Task<bool> HasPermissionWithOverrideAsync(this IUnitOfWork uow, Guid adminUserId, string permissionKey, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(adminUserId, ct);
        if (user is null || !user.IsActive) return false;

        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        if (role is null || !role.IsActive) return false;
        if (role.IsSuperAdmin) return true;

        var permission = (await uow.Permissions.GetByKeysAsync([permissionKey], ct)).FirstOrDefault();
        if (permission is null) return false;

        var overrides = await uow.AdminPermissions.GetByAdminUserAsync(adminUserId, ct);
        var overrideEntry = overrides.FirstOrDefault(o => o.PermissionId == permission.Id);
        if (overrideEntry is not null)
            return string.Equals(overrideEntry.Effect, "allow", StringComparison.OrdinalIgnoreCase);

        var permissionIds = await uow.RolePermissions.GetPermissionIdsByRoleAsync(user.RoleId, ct);
        return permissionIds.Contains(permission.Id);
    }
}

