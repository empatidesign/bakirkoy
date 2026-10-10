using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Roles.Dtos;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class RoleRepository(AppDbContext context)
    : Repository<Role>(context), IRoleRepository
{
    public async Task<PagedResult<Role>> GetPagedAsync(RoleListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(r =>
                EF.Functions.ILike(r.Name, $"%{term}%") ||
                EF.Functions.ILike(r.Key, $"%{term}%") ||
                (r.Description != null && EF.Functions.ILike(r.Description, $"%{term}%")));
        }

        if (p.IsActive.HasValue)
            query = query.Where(r => r.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<Role>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(r => r.IsActive).OrderBy(r => r.Name).ToListAsync(ct);

    public async Task<Role?> GetByKeyAsync(string key, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(r => r.Key == key, ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(
            r => EF.Functions.ILike(r.Name, LikeQuery.Escape(normalized)) && (excludeId == null || r.Id != excludeId), ct);
    }

    private static IQueryable<Role> ApplySort(IQueryable<Role> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"        => desc ? query.OrderByDescending(r => r.Name)        : query.OrderBy(r => r.Name),
            "key"         => desc ? query.OrderByDescending(r => r.Key)         : query.OrderBy(r => r.Key),
            "description" => desc ? query.OrderByDescending(r => r.Description) : query.OrderBy(r => r.Description),
            "isactive"    => desc ? query.OrderByDescending(r => r.IsActive)   : query.OrderBy(r => r.IsActive),
            "createdat"   => desc ? query.OrderByDescending(r => r.CreatedAt)  : query.OrderBy(r => r.CreatedAt),
            _             => query.OrderBy(r => r.Name),
        };
    }
}
