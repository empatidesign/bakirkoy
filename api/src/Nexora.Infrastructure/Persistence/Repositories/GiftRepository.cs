using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class GiftRepository(AppDbContext context)
    : Repository<Gift>(context), IGiftRepository
{
    public async Task<PagedResult<Gift>> GetPagedAsync(GiftListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<GiftSummaryDto> GetSummaryAsync(GiftListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var agg = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(x => x.Status == GiftStatus.Active),
                Passive = g.Count(x => x.Status == GiftStatus.Passive),
                TotalStock = g.Sum(x => x.StockLimit),
                Awarded = g.Sum(x => x.AwardedCount),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new GiftSummaryDto(0, 0, 0, 0, 0)
            : new GiftSummaryDto(agg.Total, agg.Active, agg.Passive, agg.TotalStock, agg.Awarded);
    }

    public async Task<List<Gift>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == GiftStatus.Active && x.AwardedCount < x.StockLimit).OrderBy(x => x.Name).ToListAsync(ct);

    private static IQueryable<Gift> ApplyFilters(IQueryable<Gift> query, GiftListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{term}%") || (x.Description != null && EF.Functions.ILike(x.Description, $"%{term}%")));
        }

        if (!ignoreStatus && Enum.TryParse<GiftStatus>(p.Status, out var status))
            query = query.Where(x => x.Status == status);

        return query;
    }

    private static IQueryable<Gift> ApplySort(IQueryable<Gift> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"        => desc ? query.OrderByDescending(x => x.Name)        : query.OrderBy(x => x.Name),
            "points"      => desc ? query.OrderByDescending(x => x.Points)      : query.OrderBy(x => x.Points),
            "stocklimit"  => desc ? query.OrderByDescending(x => x.StockLimit)  : query.OrderBy(x => x.StockLimit),
            "status"      => desc ? query.OrderByDescending(x => x.Status)      : query.OrderBy(x => x.Status),
            "createdat"   => desc ? query.OrderByDescending(x => x.CreatedAt)   : query.OrderBy(x => x.CreatedAt),
            _             => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}
