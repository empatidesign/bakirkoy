using System.Text;
using System.Text.Json;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Roles;
using Nexora.Application.Features.Roles.Dtos;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class RoleService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IAuditService audit,
    IActivityLogger log) : IRoleService
{
    private const string LibraryDoorAccessPermissionKey = "library-mesai.door-access";

    public async Task<PagedResult<RoleDto>> GetPagedAsync(RoleListParams p, CancellationToken ct)
    {
        var paged = await uow.Roles.GetPagedAsync(p, ct);
        var ids = paged.Items.Select(r => r.Id).ToList();
        var assigned = await uow.AdminUsers.CountByRolesAsync(ids, ct);
        var permCounts = await uow.RolePermissions.CountByRolesAsync(ids, ct);

        return new PagedResult<RoleDto>
        {
            Items = paged.Items
                .Select(r => ToDto(r, assigned.GetValueOrDefault(r.Id), permCounts.GetValueOrDefault(r.Id)))
                .ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<RoleDetailDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var role = await uow.Roles.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Rol bulunamadı.", "ROLE_NOT_FOUND");

        var assigned = await uow.AdminUsers.CountByRoleAsync(id, ct);
        var permissionIds = await uow.RolePermissions.GetPermissionIdsByRoleAsync(id, ct);
        var permissions = await uow.Permissions.GetByIdsAsync(permissionIds, ct);
        var keys = permissions.Select(p => p.Key).ToList();

        return new RoleDetailDto(
            role.Id, role.Name, role.Key, role.Description,
            role.IsActive, IsSystemKey(role.Key), role.IsSuperAdmin,
            keys.Count, assigned, role.CreatedAt, role.Color, keys);
    }

    public async Task<List<RoleOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var items = await uow.Roles.GetActiveAsync(ct);
        var roleIds = items.Select(r => r.Id).ToList();
        var libraryDoorRoleIds = roleIds.Count > 0
            ? await uow.RolePermissions.GetRoleIdsWithPermissionKeyAsync(roleIds, LibraryDoorAccessPermissionKey, ct)
            : new HashSet<Guid>();
        return items
            .Select(r => new RoleOptionDto(
                r.Key, r.Name, r.Color,
                Nexora.Application.Features.Facilities.FacilityModuleRegistry.DetectFromRoleKey(r.Key),
                libraryDoorRoleIds.Contains(r.Id)))
            .ToList();
    }

    public async Task<RoleDto> CreateAsync(CreateRoleRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (await uow.Roles.ExistsByNameAsync(req.Name, null, ct))
            throw new ConflictException("Bu rol adı zaten kullanılıyor.", "DUPLICATE_ROLE");

        var permissionIds = await ResolvePermissionIdsAsync(req.PermissionKeys, ct);
        if (permissionIds.Count == 0)
            throw new ConflictException("Rol en az bir yetkiye sahip olmalıdır.", "ROLE_NO_PERMISSIONS");

        await EnsureCanGrantPermissionsAsync(permissionIds, ct);

        var key = await GenerateUniqueKeyAsync(req.Name, ct);
        var role = Role.Create(req.Name, key, req.Description);

        var usedColors = (await uow.Roles.GetAllAsync(ct))
            .Select(r => r.Color)
            .Where(c => !string.IsNullOrEmpty(c))
            .ToHashSet();
        role.SetColor(RoleColorPalette.Pick(role.IsSuperAdmin, usedColors));

        await uow.Roles.AddAsync(role, ct);
        await uow.RolePermissions.ReplaceForRoleAsync(role.Id, permissionIds, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Role",
            EntityId = role.Id,
            Module = "Permissions",
            Description = $"Rol oluşturuldu: {role.Name} ({permissionIds.Count} yetki)",
            NewValues = JsonSerializer.Serialize(new { role.Name, role.Key, PermissionCount = permissionIds.Count }),
        }, ct);

        return ToDto(role, 0, permissionIds.Count);
    }

    public async Task<RoleDto> UpdateAsync(Guid id, UpdateRoleRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var role = await uow.Roles.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Rol bulunamadı.", "ROLE_NOT_FOUND");

        if (await uow.Roles.ExistsByNameAsync(req.Name, id, ct))
            throw new ConflictException("Bu rol adı zaten kullanılıyor.", "DUPLICATE_ROLE");

        if (role.IsSuperAdmin && req.PermissionKeys is not null)
            throw new ForbiddenException("Süper Yönetici rolünün yetki listesi değiştirilemez.", "SUPER_ADMIN_ROLE_IMMUTABLE");

        role.Update(req.Name, req.Description);
        uow.Roles.Update(role);

        var beforePermissionIds = (await uow.RolePermissions.GetPermissionIdsByRoleAsync(id, ct)).ToHashSet();

        List<Guid>? newPermissionIds = null;
        if (req.PermissionKeys is not null)
        {
            newPermissionIds = await ResolvePermissionIdsAsync(req.PermissionKeys, ct);
            if (newPermissionIds.Count == 0)
                throw new ConflictException("Rol en az bir yetkiye sahip olmalıdır.", "ROLE_NO_PERMISSIONS");

            await EnsureCanGrantPermissionsAsync(newPermissionIds, ct);
            await uow.RolePermissions.ReplaceForRoleAsync(id, newPermissionIds, ct);
        }

        await uow.SaveChangesAsync(ct);

        if (newPermissionIds is not null)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                EntityType = "Role",
                EntityId = role.Id,
                Module = "Permissions",
                Description = $"Rol güncellendi: {role.Name} (yetki sayısı {beforePermissionIds.Count} -> {newPermissionIds.Count})",
                OldValues = JsonSerializer.Serialize(new { PermissionCount = beforePermissionIds.Count }),
                NewValues = JsonSerializer.Serialize(new { PermissionCount = newPermissionIds.Count }),
            }, ct);
        }

        var assigned = await uow.AdminUsers.CountByRoleAsync(id, ct);
        var permCount = await uow.RolePermissions.CountByRoleAsync(id, ct);
        return ToDto(role, assigned, permCount);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var role = await uow.Roles.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Rol bulunamadı.", "ROLE_NOT_FOUND");

        if (role.IsSuperAdmin)
            throw new ConflictException("Süper Yönetici rolü silinemez.", "SUPER_ADMIN_ROLE_DELETE_FORBIDDEN");

        var count = await uow.AdminUsers.CountByRoleAsync(id, ct);
        if (count > 0)
            throw new ConflictException($"Bu rol {count} yöneticiye atanmış olduğu için silinemez. Önce ilgili yöneticilerin rolünü değiştirin.", "ROLE_IN_USE");

        await uow.RolePermissions.ReplaceForRoleAsync(id, [], ct);
        uow.Roles.Delete(role);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Role",
            EntityId = role.Id,
            Module = "Permissions",
            Description = $"Rol silindi: {role.Name}",
        }, ct);
    }

    public async Task<RoleDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var role = await uow.Roles.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Rol bulunamadı.", "ROLE_NOT_FOUND");

        if (role.IsSuperAdmin)
            throw new ConflictException("Süper Yönetici rolü pasife alınamaz.", "SUPER_ADMIN_ROLE_STATUS_FORBIDDEN");

        var count = await uow.AdminUsers.CountByRoleAsync(id, ct);

        if (role.IsActive && count > 0)
            throw new ConflictException($"Bu rol {count} yöneticiye atanmış olduğu için pasife alınamaz. Önce ilgili yöneticilerin rolünü değiştirin.", "ROLE_IN_USE");

        if (role.IsActive) role.Deactivate();
        else role.Activate();

        uow.Roles.Update(role);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Role",
            EntityId = role.Id,
            Module = "Permissions",
            Description = role.IsActive ? $"Rol aktifleştirildi: {role.Name}" : $"Rol pasifleştirildi: {role.Name}",
        }, ct);

        var permCount = await uow.RolePermissions.CountByRoleAsync(id, ct);
        return ToDto(role, count, permCount);
    }

    private async Task EnsureCanGrantPermissionsAsync(IReadOnlyCollection<Guid> permissionIds, CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin) return;
        if (permissionIds.Count == 0) return;
        if (currentUser.Id is not Guid callerId) return;

        var callerUser = await uow.AdminUsers.GetByIdAsync(callerId, ct);
        if (callerUser is null) return;

        var callerRole = await uow.Roles.GetByIdAsync(callerUser.RoleId, ct);
        if (callerRole?.IsSuperAdmin == true) return;

        var callerPermissionIds = (await uow.RolePermissions.GetPermissionIdsByRoleAsync(callerUser.RoleId, ct)).ToHashSet();
        var notOwned = permissionIds.Where(pid => !callerPermissionIds.Contains(pid)).ToList();
        if (notOwned.Count == 0) return;

        var notOwnedKeys = (await uow.Permissions.GetByIdsAsync(notOwned, ct)).Select(p => p.Key).ToList();
        throw new ForbiddenException(
            $"Sahip olmadığınız yetkileri bir role veremezsiniz: {string.Join(", ", notOwnedKeys)}",
            "CANNOT_GRANT_UNOWNED_PERMISSIONS");
    }

    private async Task<List<Guid>> ResolvePermissionIdsAsync(List<string>? keys, CancellationToken ct)
    {
        if (keys is null || keys.Count == 0) return [];
        var permissions = await uow.Permissions.GetByKeysAsync(keys, ct);
        return permissions.Select(p => p.Id).ToList();
    }

    private static readonly HashSet<string> SystemRoleKeys =
        new(StringComparer.OrdinalIgnoreCase) { "SuperAdmin", "Admin", "Moderator", "Staff", "ReadOnly" };

    private static bool IsSystemKey(string key) => SystemRoleKeys.Contains(key);

    private static RoleDto ToDto(Role r, int assignedCount, int permissionCount)
        => new(r.Id, r.Name, r.Key, r.Description, r.IsActive,
            IsSystemKey(r.Key), r.IsSuperAdmin, permissionCount, assignedCount, r.CreatedAt, r.Color);

    private async Task<string> GenerateUniqueKeyAsync(string name, CancellationToken ct)
    {
        var slug = Slugify(name);
        if (string.IsNullOrEmpty(slug)) slug = "rol";

        var candidate = slug;
        var counter = 2;
        while (await uow.Roles.GetByKeyAsync(candidate, ct) is not null)
            candidate = $"{slug}-{counter++}";

        return candidate;
    }

    private static string Slugify(string input)
    {
        var lower = input.Trim().ToLowerInvariant()
            .Replace('ı', 'i').Replace('ğ', 'g').Replace('ü', 'u')
            .Replace('ş', 's').Replace('ö', 'o').Replace('ç', 'c');

        var sb = new StringBuilder();
        var lastDash = false;
        foreach (var ch in lower)
        {
            if (char.IsLetterOrDigit(ch))
            {
                sb.Append(ch);
                lastDash = false;
            }
            else if (!lastDash)
            {
                sb.Append('-');
                lastDash = true;
            }
        }

        return sb.ToString().Trim('-');
    }
}
