using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelCategoryRepository(AppDbContext context)
    : Repository<TravelCategory>(context), ITravelCategoryRepository
{
    public async Task<PagedResult<TravelCategory>> GetPagedAsync(TravelCategoryListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(e => EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.Description, $"%{term}%"));
        }
        if (p.IsActive.HasValue) query = query.Where(e => e.IsActive == p.IsActive.Value);

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        query = p.Sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(e => e.Name) : query.OrderBy(e => e.Name),
            "isactive" => desc ? query.OrderByDescending(e => e.IsActive) : query.OrderBy(e => e.IsActive),
            "createdat" => desc ? query.OrderByDescending(e => e.CreatedAt) : query.OrderBy(e => e.CreatedAt),
            _ => query.OrderBy(e => e.Name),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<TravelCategory>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(e => e.IsActive).OrderBy(e => e.Name).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var lower = name.Trim();
        return await DbSet.AnyAsync(e => EF.Functions.ILike(e.Name, LikeQuery.Escape(lower)) && (!excludeId.HasValue || e.Id != excludeId.Value), ct);
    }
}
