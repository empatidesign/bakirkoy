using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Halls;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SessionRepository(AppDbContext context)
    : Repository<Session>(context), ISessionRepository
{
    public async Task<PagedResult<Session>> GetPagedAsync(SessionListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (scopedRefIds is not null) query = query.Where(s => scopedRefIds.Contains(s.Id));
        if (p.EventId.HasValue) query = query.Where(s => s.EventId == p.EventId.Value);
        if (p.IsActive.HasValue) query = query.Where(s => s.IsActive == p.IsActive.Value);
        if (p.StartDate.HasValue) query = query.Where(s => s.Date >= p.StartDate.Value.Date);
        if (p.EndDate.HasValue) query = query.Where(s => s.Date <= p.EndDate.Value.Date);
        if (p.HallId.HasValue) query = query.Where(s => s.HallId == p.HallId.Value);
        if (p.CategoryId.HasValue)
        {
            var catEventIds = Context.Set<Event>().Where(e => e.CategoryId == p.CategoryId.Value).Select(e => e.Id);
            query = query.Where(s => catEventIds.Contains(s.EventId));
        }
        if (p.FacilityId.HasValue)
        {
            var facEventIds = Context.Set<Event>().Where(e => e.FacilityId == p.FacilityId.Value).Select(e => e.Id);
            query = query.Where(s => facEventIds.Contains(s.EventId));
        }

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            var eventIds = Context.Set<Event>().Where(e => EF.Functions.ILike(e.Name, $"%{term}%")).Select(e => e.Id);
            var hallIds = Context.Set<Hall>().Where(h => EF.Functions.ILike(h.Name, $"%{term}%")).Select(h => h.Id);
            var facilityIds = Context.Set<ServiceFacility>().Where(f => EF.Functions.ILike(f.Name, $"%{term}%")).Select(f => f.Id);
            var facilityEventIds = Context.Set<Event>().Where(e => e.FacilityId != null && facilityIds.Contains(e.FacilityId.Value)).Select(e => e.Id);
            query = query.Where(s =>
                EF.Functions.ILike(s.Code, $"%{term}%") ||
                (s.Instructor != null && EF.Functions.ILike(s.Instructor, $"%{term}%")) ||
                eventIds.Contains(s.EventId) ||
                facilityEventIds.Contains(s.EventId) ||
                (s.HallId != null && hallIds.Contains(s.HallId.Value)));
        }

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<Session> ApplySort(IQueryable<Session> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "code"      => desc ? query.OrderByDescending(s => s.Code)      : query.OrderBy(s => s.Code),
            "capacity"  => desc ? query.OrderByDescending(s => s.Capacity)  : query.OrderBy(s => s.Capacity),
            "createdat" => desc ? query.OrderByDescending(s => s.CreatedAt) : query.OrderBy(s => s.CreatedAt),
            _           => desc ? query.OrderByDescending(s => s.Date).ThenByDescending(s => s.StartTime)
                                : query.OrderBy(s => s.Date).ThenBy(s => s.StartTime),
        };
    }

    public async Task<List<Session>> GetByEventAsync(Guid eventId, CancellationToken ct)
        => await DbSet.Where(s => s.EventId == eventId).OrderBy(s => s.Date).ThenBy(s => s.StartTime).ToListAsync(ct);

    public async Task<int> CountActiveByEventAsync(Guid eventId, CancellationToken ct)
        => await DbSet.CountAsync(s => s.EventId == eventId && s.IsActive, ct);

    public async Task<List<Session>> GetConflictingAsync(Guid hallId, DateTime date, string startTime, string endTime, Guid? excludeId, CancellationToken ct)
    {
        var candidates = await DbSet
            .Where(s => s.HallId == hallId && s.Date == date.Date && s.IsActive && (excludeId == null || s.Id != excludeId))
            .ToListAsync(ct);

        return candidates
            .Where(s => string.CompareOrdinal(s.StartTime, endTime) < 0 && string.CompareOrdinal(startTime, s.EndTime) < 0)
            .ToList();
    }

    public async Task<int> NextCodeNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('session_code_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<(int Total, int Active, int TotalRegistered, int TotalCapacity)> GetSummaryAsync(Guid? eventId, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (eventId.HasValue) query = query.Where(s => s.EventId == eventId.Value);

        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Active = g.Count(s => s.IsActive),
                Capacity = g.Sum(s => s.Capacity),
            })
            .FirstOrDefaultAsync(ct);

        var appQuery = Context.Set<EventApplication>().Where(a => a.Status == "approved" && a.SessionId != null);
        var registered = eventId.HasValue
            ? await appQuery.Where(a => a.EventId == eventId.Value).CountAsync(ct)
            : await appQuery.CountAsync(ct);

        return agg is null
            ? (0, 0, 0, 0)
            : (agg.Total, agg.Active, registered, agg.Capacity);
    }
}
