using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.EmergencyAreas.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.EmergencyAreas;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EmergencyAreaRepository(AppDbContext context)
    : Repository<EmergencyArea>(context), IEmergencyAreaRepository
{
    public async Task<PagedResult<EmergencyArea>> GetPagedAsync(EmergencyAreaListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        if (scopedRefIds is not null)
            query = query.Where(x => scopedRefIds.Contains(x.Id));
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<EmergencyAreaSummaryDto> GetSummaryAsync(EmergencyAreaListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var agg = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(x => x.Status == EmergencyAreaStatus.Active),
                Passive = g.Count(x => x.Status == EmergencyAreaStatus.Passive),
                TotalCapacity = g.Sum(x => x.Capacity),
                TotalAreaM2 = g.Sum(x => x.AreaSizeM2),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new EmergencyAreaSummaryDto(0, 0, 0, 0, 0)
            : new EmergencyAreaSummaryDto(agg.Total, agg.Active, agg.Passive, agg.TotalCapacity, agg.TotalAreaM2);
    }

    public async Task<List<EmergencyArea>> GetMapPointsAsync(CancellationToken ct)
        => await DbSet
            .Where(x => x.Latitude != null && x.Longitude != null)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

    public async Task<List<EmergencyArea>> GetActiveAsync(CancellationToken ct)
        => await DbSet
            .Where(x => x.Status == EmergencyAreaStatus.Active)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

    private static IQueryable<EmergencyArea> ApplyFilters(IQueryable<EmergencyArea> query, EmergencyAreaListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{term}%") ||
                EF.Functions.ILike(x.Neighborhood, $"%{term}%") ||
                EF.Functions.ILike(x.Address, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Neighborhood))
            query = query.Where(x => x.Neighborhood == p.Neighborhood);

        if (!ignoreStatus && Enum.TryParse<EmergencyAreaStatus>(p.Status, out var status))
            query = query.Where(x => x.Status == status);

        return query;
    }

    private static IQueryable<EmergencyArea> ApplySort(IQueryable<EmergencyArea> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"         => desc ? query.OrderByDescending(x => x.Name)         : query.OrderBy(x => x.Name),
            "neighborhood" => desc ? query.OrderByDescending(x => x.Neighborhood) : query.OrderBy(x => x.Neighborhood),
            "capacity"     => desc ? query.OrderByDescending(x => x.Capacity)     : query.OrderBy(x => x.Capacity),
            "areasizem2"   => desc ? query.OrderByDescending(x => x.AreaSizeM2)   : query.OrderBy(x => x.AreaSizeM2),
            "status"       => desc ? query.OrderByDescending(x => x.Status)       : query.OrderBy(x => x.Status),
            "createdat"    => desc ? query.OrderByDescending(x => x.CreatedAt)    : query.OrderBy(x => x.CreatedAt),
            _              => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}
