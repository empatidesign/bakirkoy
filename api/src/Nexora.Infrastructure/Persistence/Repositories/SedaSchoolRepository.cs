using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SedaSchoolRepository(AppDbContext context)
    : Repository<SedaSchool>(context), ISedaSchoolRepository
{
    public async Task<PagedResult<SedaSchool>> GetPagedAsync(SedaSchoolListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(s => EF.Functions.ILike(s.Name, $"%{term}%"));
        }

        if (p.IsActive.HasValue)
            query = query.Where(s => s.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<SedaSchool> ApplySort(IQueryable<SedaSchool> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(s => s.Name)      : query.OrderBy(s => s.Name),
            "isactive"  => desc ? query.OrderByDescending(s => s.IsActive)  : query.OrderBy(s => s.IsActive),
            "createdat" => desc ? query.OrderByDescending(s => s.CreatedAt) : query.OrderBy(s => s.CreatedAt),
            _           => query.OrderBy(s => s.Name),
        };
    }

    public async Task<List<SedaSchool>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(s => s.IsActive).OrderBy(s => s.Name).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(s => EF.Functions.ILike(s.Name, LikeQuery.Escape(normalized)) && (excludeId == null || s.Id != excludeId), ct);
    }
}
