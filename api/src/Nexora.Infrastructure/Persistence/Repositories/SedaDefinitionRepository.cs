using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SedaDefinitionRepository(AppDbContext context)
    : Repository<SedaDefinition>(context), ISedaDefinitionRepository
{
    public async Task<PagedResult<SedaDefinition>> GetPagedAsync(SedaDefinitionListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Type))
            query = query.Where(d => d.Type == p.Type);

        if (p.IsActive.HasValue)
            query = query.Where(d => d.IsActive == p.IsActive.Value);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(d => EF.Functions.ILike(d.Name, $"%{term}%"));
        }

        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<SedaDefinition> ApplySort(IQueryable<SedaDefinition> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(d => d.Name)      : query.OrderBy(d => d.Name),
            "isactive"  => desc ? query.OrderByDescending(d => d.IsActive)  : query.OrderBy(d => d.IsActive),
            "createdat" => desc ? query.OrderByDescending(d => d.CreatedAt) : query.OrderBy(d => d.CreatedAt),
            _           => query.OrderBy(d => d.Name),
        };
    }

    public async Task<List<SedaDefinition>> GetActiveByTypeAsync(string type, CancellationToken ct)
        => await DbSet.Where(d => d.Type == type && d.IsActive).OrderBy(d => d.Name).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string type, string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(d => d.Type == type && EF.Functions.ILike(d.Name, LikeQuery.Escape(normalized)) && (excludeId == null || d.Id != excludeId), ct);
    }
}
