using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Domain.Entities.Halls;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class HallRepository(AppDbContext context)
    : Repository<Hall>(context), IHallRepository
{
    public async Task<PagedResult<Hall>> GetPagedAsync(HallListParams p, CancellationToken ct, IReadOnlyCollection<Guid>? restrictIds = null)
    {
        var query = DbSet.AsQueryable();

        if (restrictIds is not null)
            query = query.Where(h => restrictIds.Contains(h.Id));

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(h =>
                EF.Functions.ILike(h.Name, $"%{term}%") ||
                EF.Functions.ILike(h.Type, $"%{term}%") ||
                (h.FacilityName != null && EF.Functions.ILike(h.FacilityName, $"%{term}%")));
        }

        if (p.FacilityId.HasValue)
            query = query.Where(h => h.FacilityId == p.FacilityId.Value);

        if (!string.IsNullOrWhiteSpace(p.Type))
            query = query.Where(h => h.Type == p.Type);

        if (p.IsActive.HasValue)
            query = query.Where(h => h.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<HallSummaryDto> GetSummaryAsync(HallListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (p.FacilityId.HasValue)
            query = query.Where(h => h.FacilityId == p.FacilityId.Value);

        if (!string.IsNullOrWhiteSpace(p.Type))
            query = query.Where(h => h.Type == p.Type);

        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(h => h.IsActive),
                Capacity = g.Sum(h => h.Capacity),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new HallSummaryDto(0, 0, 0, 0)
            : new HallSummaryDto(agg.Total, agg.Active, agg.Total - agg.Active, agg.Capacity);
    }

    public async Task<List<Hall>> GetByFacilityAsync(Guid facilityId, CancellationToken ct)
        => await DbSet.Where(h => h.FacilityId == facilityId).ToListAsync(ct);

    public async Task<List<Guid>> GetIdsByFacilityIdsAsync(IList<Guid> facilityIds, CancellationToken ct)
        => await DbSet.Where(h => facilityIds.Contains(h.FacilityId)).Select(h => h.Id).ToListAsync(ct);

    private static IQueryable<Hall> ApplySort(IQueryable<Hall> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(h => h.Name)      : query.OrderBy(h => h.Name),
            "type"      => desc ? query.OrderByDescending(h => h.Type)      : query.OrderBy(h => h.Type),
            "capacity"  => desc ? query.OrderByDescending(h => h.Capacity)  : query.OrderBy(h => h.Capacity),
            "isactive"  => desc ? query.OrderByDescending(h => h.IsActive)  : query.OrderBy(h => h.IsActive),
            "createdat" => desc ? query.OrderByDescending(h => h.CreatedAt) : query.OrderBy(h => h.CreatedAt),
            _           => query.OrderBy(h => h.Name),
        };
    }
}
