using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class AdminUserRepository(AppDbContext context)
    : Repository<AdminUser>(context), IAdminUserRepository
{
    public async Task<AdminUser?> GetByEmailAsync(string email, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant(), ct);

    // Telefonlar tek formatta saklanmıyor ("5321002006" ve "05321002006" birlikte
    // mevcut), bu yüzden eşleşme son 10 hane üzerinden yapılır. Aranan numaradan da
    // rakam dışı karakterler (boşluk, +90, parantez) ayıklanır.
    public async Task<AdminUser?> GetByPhoneAsync(string phone, CancellationToken ct)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 10) return null;
        var last10 = digits[^10..];

        return await DbSet.FirstOrDefaultAsync(
            u => u.Phone != null && EF.Functions.Like(u.Phone, "%" + last10), ct);
    }

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken ct)
        => await DbSet.AnyAsync(u => u.Email == email.ToLowerInvariant(), ct);

    public async Task<bool> ExistsByPhoneAsync(string phone, CancellationToken ct)
    {
        var normalized = phone.Trim();
        return await DbSet.AnyAsync(u => u.Phone != null && u.Phone == normalized, ct);
    }

    public async Task<int> CountByRoleAsync(Guid roleId, CancellationToken ct)
        => await DbSet.CountAsync(u => u.RoleId == roleId, ct);

    public async Task<Dictionary<Guid, int>> CountByRolesAsync(IReadOnlyList<Guid> roleIds, CancellationToken ct)
        => await DbSet
            .Where(u => roleIds.Contains(u.RoleId))
            .GroupBy(u => u.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, ct);

    public async Task<int> CountByDepartmentAsync(string departmentName, CancellationToken ct)
        => await DbSet.CountAsync(u => u.Department == departmentName, ct);

    public async Task<Dictionary<string, int>> CountByDepartmentsAsync(IReadOnlyList<string> departmentNames, CancellationToken ct)
        => await DbSet
            .Where(u => u.Department != null && departmentNames.Contains(u.Department))
            .GroupBy(u => u.Department!)
            .Select(g => new { Department = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Department, x => x.Count, ct);

    // 2026-07-30 P0 düzeltmesi: Departments.Name ile AdminUsers.Department arasında FK yok,
    // serbest metin karşılaştırması var. Departman adı değiştirildiğinde AdminUsers.Department
    // hiç güncellenmiyordu; bu da silme koruması ve pasife-alma cascade'inin (ToggleStatusAsync)
    // rename sonrası eski isimle eşleşen kayıtları tamamen kaçırmasına yol açıyordu. Bu metod
    // department rename'inde ilişkili tüm AdminUser kayıtlarını da toplu günceller.
    public async Task<int> RenameDepartmentAsync(string oldName, string newName, CancellationToken ct)
        => await DbSet
            .Where(u => u.Department == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.Department, newName), ct);

    public async Task<PagedResult<AdminUser>> GetPagedAsync(AdminListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());

            query = query.Where(u =>
                EF.Functions.ILike(u.FullName, $"%{term}%") ||
                EF.Functions.ILike(u.Email, $"%{term}%") ||
                (u.Phone != null && EF.Functions.ILike(u.Phone, $"%{term}%")) ||
                (u.Department != null && EF.Functions.ILike(u.Department, $"%{term}%")));
        }

        if (p.RoleId.HasValue)
            query = query.Where(u => u.RoleId == p.RoleId.Value);

        if (!string.IsNullOrWhiteSpace(p.FacilityModule))
        {
            // Kullanıcı isteği: AdminUserManagementService.DetectFacilityModule ile aynı mantık
            // (rol anahtarı facility-template modül anahtarını İÇERİYOR mu) — burada DB seviyesinde
            // uygulanır ki 100+ admin olan sistemlerde tüm liste çekilip client-side filtrelenmesin.
            var module = LikeQuery.Escape(p.FacilityModule.Trim());
            query = query.Where(u =>
                Context.Roles.Any(r => r.Id == u.RoleId && EF.Functions.ILike(r.Key, $"%{module}%")));
        }

        if (!string.IsNullOrWhiteSpace(p.Department))
            query = query.Where(u => u.Department == p.Department);

        if (p.IsActive.HasValue)
            query = query.Where(u => u.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<Guid>> GetIdsByPermissionAsync(string permissionKey, CancellationToken ct)
        => await DbSet
            .Where(u => u.IsActive && (
                Context.Roles.Any(r => r.Id == u.RoleId && r.IsSuperAdmin) ||
                Context.RolePermissions.Any(rp => rp.RoleId == u.RoleId &&
                    Context.Permissions.Any(p => p.Id == rp.PermissionId && p.Key == permissionKey && p.IsActive))))
            .Select(u => u.Id)
            .ToListAsync(ct);

    private static IQueryable<AdminUser> ApplySort(IQueryable<AdminUser> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "fullname"    => desc ? query.OrderByDescending(u => u.FullName)    : query.OrderBy(u => u.FullName),
            "email"       => desc ? query.OrderByDescending(u => u.Email)       : query.OrderBy(u => u.Email),
            "phone"       => desc ? query.OrderByDescending(u => u.Phone)       : query.OrderBy(u => u.Phone),
            "role"        => desc ? query.OrderByDescending(u => u.RoleId)      : query.OrderBy(u => u.RoleId),
            "department"  => desc ? query.OrderByDescending(u => u.Department)  : query.OrderBy(u => u.Department),
            "isactive"    => desc ? query.OrderByDescending(u => u.IsActive)    : query.OrderBy(u => u.IsActive),
            "lastloginat" => desc ? query.OrderByDescending(u => u.LastLoginAt) : query.OrderBy(u => u.LastLoginAt),
            "createdat"   => desc ? query.OrderByDescending(u => u.CreatedAt)   : query.OrderBy(u => u.CreatedAt),
            _             => query.OrderByDescending(u => u.CreatedAt),
        };
    }
}
