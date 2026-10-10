using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class RolePermissionRepository(AppDbContext context)
    : Repository<RolePermission>(context), IRolePermissionRepository
{
    public async Task<List<Guid>> GetPermissionIdsByRoleAsync(Guid roleId, CancellationToken ct)
        => await DbSet.Where(x => x.RoleId == roleId).Select(x => x.PermissionId).ToListAsync(ct);

    public async Task<int> CountByRoleAsync(Guid roleId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.RoleId == roleId, ct);

    public async Task<Dictionary<Guid, int>> CountByRolesAsync(IEnumerable<Guid> roleIds, CancellationToken ct)
    {
        var set = roleIds.Distinct().ToList();
        return await DbSet
            .Where(x => set.Contains(x.RoleId))
            .GroupBy(x => x.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, ct);
    }

    public async Task<HashSet<Guid>> GetRoleIdsWithPermissionKeyAsync(IEnumerable<Guid> roleIds, string permissionKey, CancellationToken ct)
    {
        var set = roleIds.Distinct().ToList();
        var matches = await (
            from rp in DbSet
            join p in Context.Set<Permission>() on rp.PermissionId equals p.Id
            where set.Contains(rp.RoleId) && p.Key == permissionKey
            select rp.RoleId
        ).ToListAsync(ct);
        return matches.ToHashSet();
    }

    public async Task ReplaceForRoleAsync(Guid roleId, IReadOnlyCollection<Guid> permissionIds, CancellationToken ct)
    {
        var existing = await DbSet.IgnoreQueryFilters().Where(x => x.RoleId == roleId).ToListAsync(ct);
        var desired = permissionIds.ToHashSet();

        foreach (var row in existing)
        {
            var shouldExist = desired.Contains(row.PermissionId);
            if (shouldExist && row.IsDeleted)
            {
                row.IsDeleted = false;
                row.DeletedAt = null;
                DbSet.Update(row);
            }
            else if (!shouldExist && !row.IsDeleted)
            {
                row.IsDeleted = true;
                row.DeletedAt = DateTime.UtcNow;
                DbSet.Update(row);
            }
        }

        var existingIds = existing.Select(x => x.PermissionId).ToHashSet();
        var toAdd = desired
            .Where(id => !existingIds.Contains(id))
            .Select(id => RolePermission.Create(roleId, id))
            .ToList();

        if (toAdd.Count > 0)
            await DbSet.AddRangeAsync(toAdd, ct);
    }

    public async Task AddPermissionToRolesAsync(IReadOnlyCollection<Guid> roleIds, Guid permissionId, CancellationToken ct)
    {
        if (roleIds.Count == 0) return;

        var existing = await DbSet.IgnoreQueryFilters()
            .Where(x => roleIds.Contains(x.RoleId) && x.PermissionId == permissionId)
            .ToListAsync(ct);
        var existingByRole = existing.ToDictionary(x => x.RoleId);

        foreach (var roleId in roleIds)
        {
            if (existingByRole.TryGetValue(roleId, out var row))
            {
                if (row.IsDeleted)
                {
                    row.IsDeleted = false;
                    row.DeletedAt = null;
                    DbSet.Update(row);
                }
                continue;
            }

            await DbSet.AddAsync(RolePermission.Create(roleId, permissionId), ct);
        }
    }

    public async Task RemovePermissionFromRolesAsync(IReadOnlyCollection<Guid> roleIds, Guid permissionId, CancellationToken ct)
    {
        if (roleIds.Count == 0) return;

        var existing = await DbSet
            .Where(x => roleIds.Contains(x.RoleId) && x.PermissionId == permissionId)
            .ToListAsync(ct);

        foreach (var row in existing)
        {
            row.IsDeleted = true;
            row.DeletedAt = DateTime.UtcNow;
            DbSet.Update(row);
        }
    }
}
