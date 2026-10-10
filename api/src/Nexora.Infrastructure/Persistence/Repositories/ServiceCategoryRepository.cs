using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ServiceCategoryRepository(AppDbContext context)
    : Repository<ServiceCategory>(context), IServiceCategoryRepository
{
    public async Task<PagedResult<ServiceCategory>> GetPagedAsync(ServiceCategoryListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, $"%{term}%") ||
                (c.Description != null && EF.Functions.ILike(c.Description, $"%{term}%")));
        }

        if (p.IsActive.HasValue)
            query = query.Where(c => c.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<ServiceCategory> ApplySort(IQueryable<ServiceCategory> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"         => desc ? query.OrderByDescending(c => c.Name)      : query.OrderBy(c => c.Name),
            "isactive"     => desc ? query.OrderByDescending(c => c.IsActive)  : query.OrderBy(c => c.IsActive),
            "companycount" => desc ? query.OrderByDescending(c => c.Companies.Count) : query.OrderBy(c => c.Companies.Count),
            "createdat"    => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt),
            _              => query.OrderBy(c => c.Name),
        };
    }

    public async Task<List<ServiceCategory>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(c => c.IsActive).OrderBy(c => c.Name).ToListAsync(ct);

    public async Task<List<ServiceCategory>> GetByIdsAsync(List<Guid> ids, CancellationToken ct)
        => await DbSet.Where(c => ids.Contains(c.Id)).ToListAsync(ct);

    public async Task<ServiceCategory?> GetByNameAsync(string name, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.FirstOrDefaultAsync(c => EF.Functions.ILike(c.Name, LikeQuery.Escape(normalized)), ct);
    }

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(
            c => EF.Functions.ILike(c.Name, LikeQuery.Escape(normalized)) && (excludeId == null || c.Id != excludeId),
            ct);
    }

    public async Task<int> CountCompaniesAsync(Guid categoryId, CancellationToken ct)
        => await Context.Companies.CountAsync(c => c.ServiceCategoryId == categoryId, ct);

    public async Task<Dictionary<Guid, int>> CountCompaniesByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct)
    {
        if (categoryIds.Count == 0) return [];
        var grouped = await Context.Companies
            .Where(c => c.ServiceCategoryId.HasValue && categoryIds.Contains(c.ServiceCategoryId.Value))
            .GroupBy(c => c.ServiceCategoryId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        return grouped.ToDictionary(x => x.Id, x => x.Count);
    }
}
