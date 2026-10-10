using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Public;
using Nexora.Application.Features.ServiceFacilities.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ServiceFacilityRepository(AppDbContext context)
    : Repository<ServiceFacility>(context), IServiceFacilityRepository
{
    public async Task<PagedResult<ServiceFacility>> GetPagedAsync(ServiceFacilityListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        if (scopedRefIds is not null)
            query = query.Where(x => scopedRefIds.Contains(x.Id));
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<ServiceFacility>> GetActiveOptionsAsync(IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct)
    {
        var libraryFacilityIds = Context.Set<Library>()
            .Where(l => !l.IsDeleted)
            .Select(l => l.ServiceFacilityId);
        var query = DbSet.Where(x => x.Status == FacilityStatus.Active && !libraryFacilityIds.Contains(x.Id));
        if (scopedRefIds is not null)
            query = query.Where(x => scopedRefIds.Contains(x.Id));
        return await query.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);
    }

    public async Task<ServiceFacilitySummaryDto> GetSummaryAsync(ServiceFacilityListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var agg = await baseQuery
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Indoor = g.Count(x => x.LocationType == FacilityLocationType.Indoor),
                Outdoor = g.Count(x => x.LocationType == FacilityLocationType.Outdoor),
                Active = g.Count(x => x.Status == FacilityStatus.Active),
                Services = g.Sum(x => x.ServiceCount),
            })
            .FirstOrDefaultAsync(ct);

        return agg is null
            ? new ServiceFacilitySummaryDto(0, 0, 0, 0, 0)
            : new ServiceFacilitySummaryDto(agg.Total, agg.Indoor, agg.Outdoor, agg.Active, agg.Services);
    }

    public async Task<List<ServiceFacility>> GetMapPointsAsync(CancellationToken ct)
        => await DbSet
            .Where(x => x.Latitude != null && x.Longitude != null)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

    public async Task<List<ServiceFacility>> GetPublicDiscoverAsync(PublicFacilityQuery q, CancellationToken ct)
    {
        var query = DbSet.Where(f => f.Status == FacilityStatus.Active);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var like = $"%{LikeQuery.Escape(q.Search.Trim())}%";
            query = query.Where(f => EF.Functions.ILike(f.Name, like) || EF.Functions.ILike(f.District, like) || EF.Functions.ILike(f.Address, like));
        }
        if (!string.IsNullOrWhiteSpace(q.Type)) query = query.Where(f => EF.Functions.ILike(f.Type, LikeQuery.Escape(q.Type)));
        if (!string.IsNullOrWhiteSpace(q.District)) query = query.Where(f => EF.Functions.ILike(f.District, LikeQuery.Escape(q.District)));
        if (!string.IsNullOrWhiteSpace(q.ServiceModule))
        {
            var mod = q.ServiceModule;
            query = query.Where(f => f.OfferedServices.Any(s => s.Active && EF.Functions.ILike(s.Module, LikeQuery.Escape(mod))));
        }
        var page = Math.Max(1, q.Page);
        var limit = Math.Clamp(q.Limit, 1, 200);
        return await query.OrderBy(f => f.Name).Skip((page - 1) * limit).Take(limit).ToListAsync(ct);
    }

    private IQueryable<ServiceFacility> ApplyFilters(IQueryable<ServiceFacility> query, ServiceFacilityListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{term}%") ||
                EF.Functions.ILike(x.District, $"%{term}%") ||
                EF.Functions.ILike(x.City, $"%{term}%") ||
                EF.Functions.ILike(x.Address, $"%{term}%") ||
                EF.Functions.ILike(x.Manager, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Type))
        {
            query = query.Where(x => x.Type == p.Type);
        }
        else if (!p.IncludeLibrariesResolved)
        {
            var libraryFacilityIds = Context.Set<Library>()
                .Where(l => !l.IsDeleted)
                .Select(l => l.ServiceFacilityId);
            query = query.Where(x => !libraryFacilityIds.Contains(x.Id));
        }

        if (Enum.TryParse<FacilityLocationType>(p.LocationType, out var locationType))
            query = query.Where(x => x.LocationType == locationType);

        if (!ignoreStatus && Enum.TryParse<FacilityStatus>(p.Status, out var status))
            query = query.Where(x => x.Status == status);

        return query;
    }

    private static IQueryable<ServiceFacility> ApplySort(IQueryable<ServiceFacility> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(x => x.Name)      : query.OrderBy(x => x.Name),
            "type"      => desc ? query.OrderByDescending(x => x.Type)      : query.OrderBy(x => x.Type),
            "status"    => desc ? query.OrderByDescending(x => x.Status)    : query.OrderBy(x => x.Status),
            "createdat" => desc ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt),
            _           => query.OrderByDescending(x => x.CreatedAt),
        };
    }

    public async Task<HashSet<string>> GetExistingNamesAsync(CancellationToken ct)
    {
        var names = await DbSet.AsNoTracking().Select(f => f.Name).ToListAsync(ct);
        return names.Select(n => n.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
