using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Wheels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class WheelRepository(AppDbContext context)
    : Repository<Wheel>(context), IWheelRepository
{
    public async Task<PagedResult<Wheel>> GetPagedAsync(WheelListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<WheelSummaryDto> GetSummaryAsync(WheelListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var agg = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(x => x.Status == WheelStatus.Active),
                Passive = g.Count(x => x.Status == WheelStatus.Passive),
                TotalSpins = g.Sum(x => x.TotalSpins),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new WheelSummaryDto(0, 0, 0, 0)
            : new WheelSummaryDto(agg.Total, agg.Active, agg.Passive, agg.TotalSpins);
    }

    private static IQueryable<Wheel> ApplyFilters(IQueryable<Wheel> query, WheelListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.Title, $"%{term}%") || (x.Description != null && EF.Functions.ILike(x.Description, $"%{term}%")));
        }

        if (!ignoreStatus && Enum.TryParse<WheelStatus>(p.Status, out var status))
            query = query.Where(x => x.Status == status);

        return query;
    }

    private static IQueryable<Wheel> ApplySort(IQueryable<Wheel> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "title"      => desc ? query.OrderByDescending(x => x.Title)      : query.OrderBy(x => x.Title),
            "totalspins" => desc ? query.OrderByDescending(x => x.TotalSpins) : query.OrderBy(x => x.TotalSpins),
            "status"     => desc ? query.OrderByDescending(x => x.Status)     : query.OrderBy(x => x.Status),
            "createdat"  => desc ? query.OrderByDescending(x => x.CreatedAt)  : query.OrderBy(x => x.CreatedAt),
            _            => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}
