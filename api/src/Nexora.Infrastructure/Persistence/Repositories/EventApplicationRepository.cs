using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EventApplicationRepository(AppDbContext context)
    : Repository<EventApplication>(context), IEventApplicationRepository
{
    public async Task<PagedResult<EventApplication>> GetPagedAsync(ApplicationListParams p, IReadOnlyCollection<Guid>? scopedEventIds, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (scopedEventIds is not null)
        {
            if (scopedEventIds.Count == 0)
                return new PagedResult<EventApplication> { Items = [], Total = 0, Page = p.PageResolved, Limit = p.LimitResolved };
            var scoped = scopedEventIds.ToList();
            query = query.Where(a => scoped.Contains(a.EventId));
        }

        if (p.EventId.HasValue) query = query.Where(a => a.EventId == p.EventId.Value);
        if (p.SessionId.HasValue) query = query.Where(a => a.SessionId == p.SessionId.Value);
        if (!string.IsNullOrWhiteSpace(p.Status))
        {
            var statuses = p.Status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            query = statuses.Length <= 1
                ? query.Where(a => a.Status == p.Status)
                : query.Where(a => statuses.Contains(a.Status));
        }

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = p.Search.Trim();
            var searchTerm = LikeQuery.Escape(term);
            var participantIds = Context.Set<Participant>()
                .Where(x => EF.Functions.ILike(x.FullName, $"%{searchTerm}%") || x.Tckn.Contains(term) || (x.Phone != null && x.Phone.Contains(term)) || (x.Email != null && EF.Functions.ILike(x.Email, $"%{searchTerm}%")))
                .Select(x => x.Id);
            query = query.Where(a => EF.Functions.ILike(a.Code, $"%{searchTerm}%") || participantIds.Contains(a.ParticipantId));
        }

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<PagedResult<EventApplication>> GetByParticipantsAsync(List<Guid> participantIds, string? status, string? period, int page, int limit, CancellationToken ct)
    {
        if (participantIds.Count == 0)
            return new PagedResult<EventApplication> { Items = [], Total = 0, Page = page, Limit = limit };

        var query = DbSet.Where(a => participantIds.Contains(a.ParticipantId));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(a => a.Status == status);

        if (!string.IsNullOrWhiteSpace(period))
        {
            var today = TurkeyTime.TodayDate();
            (DateTime from, DateTime to) = period.ToLowerInvariant() switch
            {
                "today" => (today, today.AddDays(1)),
                "week"  => (today.AddDays(-(int)today.DayOfWeek), today.AddDays(7 - (int)today.DayOfWeek)),
                "month" => (new DateTime(today.Year, today.Month, 1), new DateTime(today.Year, today.Month, 1).AddMonths(1)),
                "year"  => (new DateTime(today.Year, 1, 1), new DateTime(today.Year + 1, 1, 1)),
                _       => (DateTime.MinValue, DateTime.MaxValue),
            };
            if (from != DateTime.MinValue)
                query = query.Where(a => a.ReferenceDate >= from && a.ReferenceDate < to);
        }

        var todayUtc = TurkeyTime.TodayDate();
        var ordered = query
            .OrderBy(a => a.ReferenceDate >= todayUtc ? 0 : 1)
            .ThenBy(a => a.ReferenceDate >= todayUtc ? a.ReferenceDate : DateTime.MaxValue)
            .ThenByDescending(a => a.ReferenceDate < todayUtc ? a.ReferenceDate : DateTime.MinValue)
            .ThenBy(a => Context.Set<Session>()
                .Where(s => a.SessionId != null && s.Id == a.SessionId)
                .Select(s => s.StartTime)
                .FirstOrDefault())
            .ThenBy(a => a.CreatedAt);

        return await PaginateAsync(ordered, page, limit, ct);
    }

    public async Task<List<Guid>> GetParticipantIdsBySessionsAsync(IReadOnlyCollection<Guid> sessionIds, CancellationToken ct)
    {
        if (sessionIds.Count == 0) return [];
        return await DbSet
            .Where(a => a.SessionId != null && sessionIds.Contains(a.SessionId.Value))
            .Select(a => a.ParticipantId)
            .Distinct()
            .ToListAsync(ct);
    }

    public async Task<List<Guid>> GetParticipantIdsByEventsAsync(IReadOnlyCollection<Guid> eventIds, CancellationToken ct)
    {
        if (eventIds.Count == 0) return [];
        return await DbSet
            .Where(a => eventIds.Contains(a.EventId) && a.Status != "rejected" && a.Status != "cancelled")
            .Select(a => a.ParticipantId)
            .Distinct()
            .ToListAsync(ct);
    }

    private static IQueryable<EventApplication> ApplySort(IQueryable<EventApplication> query, string? sort, string? order)
    {
        var desc = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "status"        => desc ? query.OrderByDescending(a => a.Status)        : query.OrderBy(a => a.Status),
            "eventdate"     => desc ? query.OrderByDescending(a => a.ReferenceDate) : query.OrderBy(a => a.ReferenceDate),
            "referencedate" => desc ? query.OrderByDescending(a => a.ReferenceDate) : query.OrderBy(a => a.ReferenceDate),
            _               => desc ? query.OrderByDescending(a => a.CreatedAt)     : query.OrderBy(a => a.CreatedAt),
        };
    }

    public async Task<(int Total, int Approved, int Pending, int Rejected, int Reviewing, int Waitlist)> GetSummaryAsync(Guid? eventId, Guid? sessionId, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (eventId.HasValue) query = query.Where(a => a.EventId == eventId.Value);
        if (sessionId.HasValue) query = query.Where(a => a.SessionId == sessionId.Value);

        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Approved = g.Count(a => a.Status == "approved"),
                Pending = g.Count(a => a.Status == "pending"),
                Rejected = g.Count(a => a.Status == "rejected"),
                Reviewing = g.Count(a => a.Status == "reviewing"),
                Waitlist = g.Count(a => a.Status == "waitlist"),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? (0, 0, 0, 0, 0, 0)
            : (agg.Total, agg.Approved, agg.Pending, agg.Rejected, agg.Reviewing, agg.Waitlist);
    }

    public async Task<int> CountByEventAndStatusAsync(Guid eventId, string status, CancellationToken ct)
        => await DbSet.CountAsync(a => a.EventId == eventId && a.Status == status, ct);

    public async Task<int> GetWaitlistPositionAsync(Guid eventId, Guid? sessionId, Guid applicationId, CancellationToken ct)
    {
        var app = await DbSet.FirstOrDefaultAsync(a => a.Id == applicationId, ct);
        if (app is null) return 0;
        var earlier = await DbSet.CountAsync(a =>
            a.EventId == eventId
            && a.SessionId == sessionId
            && a.Status == "waitlist"
            && a.CreatedAt < app.CreatedAt, ct);
        return earlier + 1;
    }

    public async Task<(int Approved, int Pending, int Waitlist)> CountByScopeAsync(Guid eventId, Guid? sessionId, CancellationToken ct)
    {
        var agg = await DbSet
            .Where(a => a.EventId == eventId && a.SessionId == sessionId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Approved = g.Count(a => a.Status == "approved"),
                Pending = g.Count(a => a.Status == "pending"),
                Waitlist = g.Count(a => a.Status == "waitlist"),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null ? (0, 0, 0) : (agg.Approved, agg.Pending, agg.Waitlist);
    }

    public async Task<List<EventApplication>> GetWaitlistOrderedAsync(Guid eventId, Guid? sessionId, CancellationToken ct)
        => await DbSet
            .Where(a => a.EventId == eventId && a.SessionId == sessionId && a.Status == "waitlist")
            .OrderBy(a => a.CreatedAt)
            .ToListAsync(ct);

    public async Task<int> CountActiveByParticipantInWindowAsync(Guid eventId, Guid participantId, DateTime start, DateTime end, Guid? excludeId, CancellationToken ct)
        => await DbSet.CountAsync(a =>
            a.EventId == eventId &&
            a.ParticipantId == participantId &&
            a.Status != "rejected" &&
            a.Status != "cancelled" &&
            a.ReferenceDate >= start &&
            a.ReferenceDate < end &&
            (excludeId == null || a.Id != excludeId), ct);

    public async Task<bool> IsSeatTakenAsync(Guid eventId, Guid? sessionId, string seatNumber, Guid? excludeId, CancellationToken ct)
        => await DbSet.AnyAsync(a =>
            a.EventId == eventId &&
            a.SessionId == sessionId &&
            a.SeatNumber == seatNumber &&
            a.Status != "rejected" &&
            a.Status != "cancelled" &&
            (excludeId == null || a.Id != excludeId), ct);

    public async Task<Dictionary<Guid, (int Approved, int Pending, int Waitlist)>> CountByEventsAsync(List<Guid> eventIds, CancellationToken ct)
    {
        if (eventIds.Count == 0) return [];

        var rows = await DbSet
            .Where(a => eventIds.Contains(a.EventId) && (a.Status == "approved" || a.Status == "pending" || a.Status == "waitlist"))
            .GroupBy(a => a.EventId)
            .Select(g => new
            {
                EventId = g.Key,
                Approved = g.Count(a => a.Status == "approved"),
                Pending = g.Count(a => a.Status == "pending"),
                Waitlist = g.Count(a => a.Status == "waitlist"),
            })
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.EventId, r => (r.Approved, r.Pending, r.Waitlist));
    }

    public async Task<int> CountByStatusAsync(string status, CancellationToken ct)
        => await DbSet.CountAsync(a => a.Status == status, ct);

    // Kullanıcı bulgusu (2026-08-09): bkz. IEventApplicationRepository üzerindeki not.
    // ParticipantEventHistoryService.GetListAsync (drilldown paneli) tüm durumları
    // (rejected dahil) "geçmiş" sayıyor — bu sayaç aynı semantiğe uyar ki liste
    // sütunundaki rakam, tıklanınca açılan panelde görünen toplam satır sayısıyla
    // tutarlı olsun.
    public async Task<Dictionary<Guid, int>> CountForParticipantsAsync(IReadOnlyList<Guid> participantIds, CancellationToken ct)
    {
        if (participantIds.Count == 0) return [];
        return await DbSet.AsNoTracking()
            .Where(a => participantIds.Contains(a.ParticipantId))
            .GroupBy(a => a.ParticipantId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);
    }

    public async Task<int> NextCodeNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('event_application_code_seq') AS \"Value\"")
            .FirstAsync(ct);
}
