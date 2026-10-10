using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class LibraryStaffRepository(AppDbContext context) : Repository<LibraryStaff>(context), ILibraryStaffRepository
{
    public async Task<PagedResult<LibraryStaff>> GetPagedAsync(LibraryStaffListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (scopedLibraryIds is not null)
            query = query.Where(x => x.WorkingLibraryIds.Any(id => scopedLibraryIds.Contains(id)));
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x => EF.Functions.ILike(x.FullName, $"%{s}%") || (x.Email != null && EF.Functions.ILike(x.Email, $"%{s}%")) || (x.RoleName != null && EF.Functions.ILike(x.RoleName, $"%{s}%")));
        }
        if (p.IsActive.HasValue) query = query.Where(x => x.IsActive == p.IsActive.Value);
        if (Guid.TryParse(p.LibraryId, out var libId)) query = query.Where(x => x.WorkingLibraryIds.Contains(libId));
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<LibraryStaff>> GetEligibleAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.WorkingLibraryIds.Contains(libraryId)).OrderBy(x => x.FullName).ToListAsync(ct);

    public async Task<bool> ExistsByAdminUserAsync(Guid adminUserId, Guid? excludeId, CancellationToken ct)
        => await DbSet.AnyAsync(x => x.AdminUserId == adminUserId && (excludeId == null || x.Id != excludeId.Value), ct);

    public async Task<LibraryStaff?> GetByAdminUserAsync(Guid adminUserId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.AdminUserId == adminUserId, ct);

    public async Task<bool> ExistsByParticipantAsync(Guid participantId, Guid? excludeId, CancellationToken ct)
        => await DbSet.AnyAsync(x => x.ParticipantId == participantId && (excludeId == null || x.Id != excludeId.Value), ct);

    public async Task<LibraryStaff?> GetByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.ParticipantId == participantId, ct);

    private static IQueryable<LibraryStaff> ApplySort(IQueryable<LibraryStaff> q, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "fullname" => desc ? q.OrderByDescending(x => x.FullName) : q.OrderBy(x => x.FullName),
            "isactive" => desc ? q.OrderByDescending(x => x.IsActive) : q.OrderBy(x => x.IsActive),
            "createdat" => desc ? q.OrderByDescending(x => x.CreatedAt) : q.OrderBy(x => x.CreatedAt),
            _ => q.OrderBy(x => x.FullName),
        };
    }
}

public class LibraryShiftRepository(AppDbContext context) : Repository<LibraryShift>(context), ILibraryShiftRepository
{
    public async Task<List<LibraryShift>> GetActiveByLibraryAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == libraryId && x.Status == "active").OrderBy(x => x.StartTime).ToListAsync(ct);

    public async Task<LibraryShift?> GetActiveByStaffAsync(Guid staffId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.StaffId == staffId && x.Status == "active", ct);

    public async Task<LibraryShift?> GetActiveByIpAsync(string ipAddress, Guid excludeStaffId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(
            x => x.IpAddress == ipAddress && x.Status == "active" && x.StaffId != excludeStaffId, ct);

    public async Task<List<LibraryShift>> GetAllActiveAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == "active").ToListAsync(ct);

    public async Task<List<LibraryShift>> GetByStaffAsync(Guid staffId, CancellationToken ct)
        => await DbSet.Where(x => x.StaffId == staffId).OrderByDescending(x => x.StartTime).Take(100).ToListAsync(ct);

    public async Task<PagedResult<LibraryShift>> GetPagedByLibraryAsync(Guid libraryId, LibraryShiftListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.LibraryId == libraryId);
        query = ApplyFilters(query, p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<PagedResult<LibraryShift>> GetPagedOverviewAsync(LibraryShiftListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (scopedLibraryIds is not null) query = query.Where(x => scopedLibraryIds.Contains(x.LibraryId));
        if (Guid.TryParse(p.LibraryId, out var libId)) query = query.Where(x => x.LibraryId == libId);
        query = ApplyFilters(query, p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<LibraryShift>> GetForStaffInRangeAsync(Guid staffId, DateTime startUtc, DateTime endUtc, CancellationToken ct)
        => await DbSet
            .Where(x => x.StaffId == staffId && x.StartTime >= startUtc && x.StartTime < endUtc)
            .OrderByDescending(x => x.StartTime)
            .ToListAsync(ct);

    public async Task<List<LibraryShift>> GetInRangeAsync(DateTime startUtc, DateTime endUtc, Guid? libraryId, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.StartTime >= startUtc && x.StartTime < endUtc);
        if (scopedLibraryIds is not null) query = query.Where(x => scopedLibraryIds.Contains(x.LibraryId));
        if (libraryId.HasValue) query = query.Where(x => x.LibraryId == libraryId.Value);
        return await query.ToListAsync(ct);
    }

    public async Task<List<LibraryShift>> GetAllOpenAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == "active").ToListAsync(ct);

    public async Task<int> CountActiveByLibraryAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.LibraryId == libraryId && x.Status == "active", ct);

    public async Task<int> CountTodayByLibraryAsync(Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.LibraryId == libraryId && x.StartTime >= dayStart, ct);

    public async Task<int> CountTodayAsync(DateTime dayStart, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.StartTime >= dayStart);
        if (scopedLibraryIds is not null) query = query.Where(x => scopedLibraryIds.Contains(x.LibraryId));
        return await query.CountAsync(ct);
    }

    private static IQueryable<LibraryShift> ApplyFilters(IQueryable<LibraryShift> query, LibraryShiftListParams p)
    {
        if (Guid.TryParse(p.StaffId, out var staffId)) query = query.Where(x => x.StaffId == staffId);
        if (p.StartDate.HasValue) query = query.Where(x => x.StartTime >= p.StartDate.Value);
        if (p.EndDate.HasValue) query = query.Where(x => x.StartTime < p.EndDate.Value);
        if (!string.IsNullOrWhiteSpace(p.Status)) query = query.Where(x => x.Status == p.Status);
        return query;
    }

    private static IQueryable<LibraryShift> ApplySort(IQueryable<LibraryShift> query, string? sort, string? order)
    {
        var asc = string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return (sort?.ToLowerInvariant()) switch
        {
            "starttime" => asc ? query.OrderBy(x => x.StartTime) : query.OrderByDescending(x => x.StartTime),
            _ => query.OrderByDescending(x => x.StartTime),
        };
    }
}
