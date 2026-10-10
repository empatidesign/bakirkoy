using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EventActivityRepository(AppDbContext context)
    : Repository<EventActivity>(context), IEventActivityRepository
{
    public async Task<PagedResult<EventActivity>> GetPagedAsync(ActivityListParams p, IReadOnlyCollection<Guid>? scopedEventIds, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        if (scopedEventIds is not null)
            query = query.Where(a => scopedEventIds.Contains(a.EventId));
        var desc = !string.Equals(p.Order, "asc", StringComparison.OrdinalIgnoreCase);
        query = desc ? query.OrderByDescending(a => a.At) : query.OrderBy(a => a.At);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<(int CheckIn, int CheckOut, int Kiosk, int WalkIn)> GetSummaryAsync(ActivityListParams p, IReadOnlyCollection<Guid>? scopedEventIds, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);
        if (scopedEventIds is not null)
            query = query.Where(a => scopedEventIds.Contains(a.EventId));
        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                CheckIn = g.Count(a => a.Kind == "check_in"),
                CheckOut = g.Count(a => a.Kind == "check_out"),
                Kiosk = g.Count(a => a.Method == "Kiosk"),
                WalkIn = g.Count(a => a.WalkIn),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? (0, 0, 0, 0)
            : (agg.CheckIn, agg.CheckOut, agg.Kiosk, agg.WalkIn);
    }

    public Task<bool> HasCheckedInAsync(Guid eventId, Guid participantId, CancellationToken ct)
        => DbSet.AnyAsync(a => a.EventId == eventId && a.ParticipantId == participantId && a.Kind == "check_in", ct);

    public async Task<string?> GetLastKindAsync(Guid eventId, Guid? sessionId, Guid participantId, CancellationToken ct)
        => await DbSet
            .Where(a => a.EventId == eventId && a.SessionId == sessionId && a.ParticipantId == participantId)
            .OrderByDescending(a => a.At)
            .Select(a => a.Kind)
            .FirstOrDefaultAsync(ct);

    public async Task<EventActivity?> GetLastAsync(Guid eventId, Guid? sessionId, Guid participantId, CancellationToken ct)
        => await DbSet
            .Where(a => a.EventId == eventId && a.SessionId == sessionId && a.ParticipantId == participantId)
            .OrderByDescending(a => a.At)
            .FirstOrDefaultAsync(ct);

    public async Task<HashSet<Guid>> GetCheckedInEventIdsAsync(Guid participantId, List<Guid> eventIds, CancellationToken ct)
    {
        var ids = await DbSet
            .Where(a => a.ParticipantId == participantId && eventIds.Contains(a.EventId) && a.Kind == "check_in")
            .Select(a => a.EventId)
            .Distinct()
            .ToListAsync(ct);
        return new HashSet<Guid>(ids);
    }

    public async Task<Dictionary<Guid, DateTime>> GetMostRecentCheckInAtByEventAsync(CancellationToken ct)
        => await DbSet
            .Where(a => a.Kind == "check_in")
            .GroupBy(a => a.EventId)
            .Select(g => new { EventId = g.Key, LastAt = g.Max(a => a.At) })
            .ToDictionaryAsync(x => x.EventId, x => x.LastAt, ct);

    private IQueryable<EventActivity> ApplyFilters(IQueryable<EventActivity> query, ActivityListParams p)
    {
        if (p.Date.HasValue)
        {
            var start = p.Date.Value.Date;
            var end = start.AddDays(1);
            query = query.Where(a => a.At >= start && a.At < end);
        }
        if (p.EventId.HasValue) query = query.Where(a => a.EventId == p.EventId.Value);
        if (p.SessionId.HasValue) query = query.Where(a => a.SessionId == p.SessionId.Value);
        if (p.HallId.HasValue)
        {
            var hallId = p.HallId.Value;
            query = query.Where(a => Context.Set<Event>()
                .Where(e => e.HallId == hallId && !e.IsDeleted)
                .Select(e => e.Id)
                .Contains(a.EventId));
        }
        if (!string.IsNullOrWhiteSpace(p.Kind)) query = query.Where(a => a.Kind == p.Kind);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = p.Search;
            var searchTerm = LikeQuery.Escape(s);
            query = query.Where(a => EF.Functions.ILike(a.ParticipantName, $"%{searchTerm}%") || a.Tckn.Contains(s));
        }
        return query;
    }
}
