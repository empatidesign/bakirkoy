using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.ParticipantLibraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class LibraryRepository(AppDbContext context) : Repository<Library>(context), ILibraryRepository
{
    public async Task<PagedResult<Library>> GetPagedAsync(LibraryListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.Where(x => !x.IsDeleted), p);
        if (scopedRefIds is not null)
            query = query.Where(x => scopedRefIds.Contains(x.Id));
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<Library>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(x => x.IsActive).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<PagedResult<Library>> DiscoverPagedAsync(CitizenLibraryDiscoverParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.IsActive);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var like = $"%{LikeQuery.Escape(p.Search.Trim())}%";
            query = query.Where(l =>
                EF.Functions.ILike(l.Name, like)
                || (l.District != null && EF.Functions.ILike(l.District, like))
                || (l.City != null && EF.Functions.ILike(l.City, like))
                || (l.Address != null && EF.Functions.ILike(l.Address, like)));
        }

        if (!string.IsNullOrWhiteSpace(p.AreaType))
            query = query.Where(l => l.AreaType == p.AreaType);

        if (p.OnlyAvailable == true)
            query = query.Where(l => l.Capacity <= 0
                || Context.Set<LibrarySession>().Count(s => s.LibraryId == l.Id && LibrarySessionStatus.ActiveStatuses.Contains(s.Status)) < l.Capacity);

        if (!string.IsNullOrWhiteSpace(p.District))
            query = query.Where(l => l.District == p.District);

        if (p.OnlyReservable == true)
            query = query.Where(l => l.ReservationEnabled);

        if (!string.IsNullOrWhiteSpace(p.AccessType))
            query = query.Where(l => l.AccessType == p.AccessType);

        if (!string.IsNullOrWhiteSpace(p.SeatingMode))
            query = query.Where(l => l.SeatingMode == p.SeatingMode);

        if (p.OnlyQueueEnabled == true)
            query = query.Where(l => l.QueueEnabled);

        if (!string.IsNullOrWhiteSpace(p.Amenity))
            query = query.Where(l => l.Amenities.Contains(p.Amenity));

        return await PaginateAsync(query.OrderBy(l => l.Name), p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<LibraryOverviewSummaryDto> GetOverviewSummaryAsync(CancellationToken ct)
    {
        var agg = await DbSet
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(x => x.IsActive),
                ActiveCapacity = g.Sum(x => x.IsActive ? x.Capacity : 0),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? new LibraryOverviewSummaryDto(0, 0, 0, 0, 0, 0, 0, 0)
            : new LibraryOverviewSummaryDto(agg.Total, agg.Active, agg.Total - agg.Active, agg.ActiveCapacity, 0, 0, 0, 0);
    }

    public async Task<Library?> GetByStaticQrCodeAsync(string code, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.StaticQrCode == code, ct);

    public async Task<bool> ExistsByStaticQrCodeAsync(string code, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().AnyAsync(x => x.StaticQrCode == code, ct);

    private static IQueryable<Library> ApplyFilters(IQueryable<Library> query, LibraryListParams p)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{term}%") ||
                (x.District != null && EF.Functions.ILike(x.District, $"%{term}%")) ||
                (x.City != null && EF.Functions.ILike(x.City, $"%{term}%")) ||
                (x.Address != null && EF.Functions.ILike(x.Address, $"%{term}%")) ||
                (x.ServiceFacilityName != null && EF.Functions.ILike(x.ServiceFacilityName, $"%{term}%")) ||
                EF.Functions.ILike(x.ManagerName, $"%{term}%"));
        }

        if (string.Equals(p.Status, "active", StringComparison.OrdinalIgnoreCase))
            query = query.Where(x => x.IsActive);
        else if (string.Equals(p.Status, "passive", StringComparison.OrdinalIgnoreCase))
            query = query.Where(x => !x.IsActive);

        return query;
    }

    private static IQueryable<Library> ApplySort(IQueryable<Library> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(x => x.Name) : query.OrderBy(x => x.Name),
            "capacity" => desc ? query.OrderByDescending(x => x.Capacity) : query.OrderBy(x => x.Capacity),
            "isactive" => desc ? query.OrderByDescending(x => x.IsActive) : query.OrderBy(x => x.IsActive),
            "createdat" => desc ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt),
            _ => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}

public class LibrarySettingsRepository(AppDbContext context) : Repository<LibrarySettings>(context), ILibrarySettingsRepository
{
    public async Task<LibrarySettings?> GetForLibraryAsync(Guid? libraryId, CancellationToken ct)
        => libraryId is null
            ? await DbSet.FirstOrDefaultAsync(x => x.LibraryId == null, ct)
            : await DbSet.FirstOrDefaultAsync(x => x.LibraryId == libraryId, ct);

    public async Task<List<LibrarySettings>> GetSettingsForLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == null || (x.LibraryId != null && libraryIds.Contains(x.LibraryId.Value))).ToListAsync(ct);
}

public class LibrarySettingsHistoryRepository(AppDbContext context) : Repository<LibrarySettingsHistory>(context), ILibrarySettingsHistoryRepository
{
    public async Task<List<LibrarySettingsHistory>> GetForLibraryAsync(Guid? libraryId, int limit, CancellationToken ct)
        => await DbSet
            .Where(x => libraryId == null ? x.LibraryId == null : x.LibraryId == libraryId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(limit)
            .ToListAsync(ct);
}
