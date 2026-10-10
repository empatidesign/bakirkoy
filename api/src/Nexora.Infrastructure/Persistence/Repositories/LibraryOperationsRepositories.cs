using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class LibrarySessionRepository(AppDbContext context) : Repository<LibrarySession>(context), ILibrarySessionRepository
{
    public async Task<PagedResult<LibrarySession>> GetOccupantsPagedAsync(Guid libraryId, OccupantListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.LibraryId == libraryId && LibrarySessionStatus.ActiveStatuses.Contains(x.Status));
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.MemberName, $"%{t}%") || (x.Seat != null && EF.Functions.ILike(x.Seat, $"%{t}%")));
        }
        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        query = (p.Sort?.ToLowerInvariant()) switch
        {
            "duration" => desc ? query.OrderBy(x => x.EntryTime) : query.OrderByDescending(x => x.EntryTime),
            _ => desc ? query.OrderByDescending(x => x.EntryTime) : query.OrderBy(x => x.EntryTime),
        };
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<PagedResult<LibrarySession>> GetExitedPagedAsync(Guid libraryId, DateTime date, ExitedListParams p, CancellationToken ct)
    {
        var dayStart = date;
        var dayEnd = dayStart.AddDays(1);
        var query = DbSet.Where(x => x.LibraryId == libraryId
            && !LibrarySessionStatus.ActiveStatuses.Contains(x.Status)
            && x.ExitTime != null && x.ExitTime >= dayStart && x.ExitTime < dayEnd);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.MemberName, $"%{t}%"));
        }
        query = query.OrderByDescending(x => x.ExitTime);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<int> CountInsideAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.LibraryId == libraryId && LibrarySessionStatus.ActiveStatuses.Contains(x.Status), ct);

    public async Task<int> CountOnBreakAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.LibraryId == libraryId && (x.Status == "on_break_short" || x.Status == "on_break_long"), ct);

    public async Task<LibrarySession?> GetActiveByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.ParticipantId == participantId && LibrarySessionStatus.ActiveStatuses.Contains(x.Status), ct);

    public async Task<LibrarySession?> GetActiveByTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Tckn == tckn && LibrarySessionStatus.ActiveStatuses.Contains(x.Status), ct);

    public async Task<int> CountTodayByParticipantLibraryAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.ParticipantId == participantId && x.LibraryId == libraryId && x.EntryTime >= dayStart, ct);

    public async Task<int> CountTodayByTcknLibraryAsync(string tckn, Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.Tckn == tckn && x.LibraryId == libraryId && x.EntryTime >= dayStart, ct);

    public async Task<List<LibrarySession>> GetActiveSessionsAsync(CancellationToken ct)
        => await DbSet.Where(x => LibrarySessionStatus.ActiveStatuses.Contains(x.Status)).ToListAsync(ct);

    public async Task<List<LibrarySession>> GetActiveByLibraryAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == libraryId && LibrarySessionStatus.ActiveStatuses.Contains(x.Status)).ToListAsync(ct);

    public async Task<List<LibrarySession>> GetByLibraryEntryRangeAsync(Guid libraryId, DateTime from, DateTime to, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == libraryId && x.EntryTime >= from && x.EntryTime < to).ToListAsync(ct);

    public async Task<List<LibrarySession>> GetByParticipantEntryRangeAsync(Guid participantId, DateTime from, DateTime to, CancellationToken ct)
        => await DbSet.Where(x => x.ParticipantId == participantId && x.EntryTime >= from && x.EntryTime < to)
            .OrderBy(x => x.EntryTime).ToListAsync(ct);

    public async Task<int> CountAllInsideAsync(CancellationToken ct)
        => await DbSet.CountAsync(x => LibrarySessionStatus.ActiveStatuses.Contains(x.Status), ct);

    public async Task<int> CountAllOnBreakAsync(CancellationToken ct)
        => await DbSet.CountAsync(x => (x.Status == "on_break_short" || x.Status == "on_break_long"), ct);

    public async Task<Dictionary<Guid, int>> CountInsideByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct)
        => await DbSet
            .Where(x => libraryIds.Contains(x.LibraryId) && LibrarySessionStatus.ActiveStatuses.Contains(x.Status))
            .GroupBy(x => x.LibraryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

    public async Task<Dictionary<Guid, int>> CountOnBreakByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct)
        => await DbSet
            .Where(x => libraryIds.Contains(x.LibraryId) && (x.Status == "on_break_short" || x.Status == "on_break_long"))
            .GroupBy(x => x.LibraryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

    public async Task<List<LibrarySession>> GetExpiredExitIntentsAsync(DateTime expiredBefore, CancellationToken ct)
        => await DbSet
            .Where(s => s.PendingExitAt.HasValue && s.PendingExitAt < expiredBefore
                && LibrarySessionStatus.ActiveStatuses.Contains(s.Status))
            .ToListAsync(ct);

    public async Task<int> CountTodayExitNoShowsAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(s => s.ParticipantId == participantId && s.LibraryId == libraryId
            && s.IsExitNoShow && s.ExitTime.HasValue && s.ExitTime.Value >= dayStart, ct);

    public async Task<PagedResult<LibrarySession>> GetAllOccupantsPagedAsync(string? statusFilter, AllLibrariesPersonListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.Where(x => LibrarySessionStatus.ActiveStatuses.Contains(x.Status));
        if (scopedLibraryIds is not null)
            query = query.Where(x => scopedLibraryIds.Contains(x.LibraryId));
        query = statusFilter switch
        {
            "inside" => query.Where(x => x.Status == "inside"),
            "onBreak" => query.Where(x => x.Status == "on_break_short" || x.Status == "on_break_long"),
            _ => query,
        };
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.MemberName, $"%{t}%") || (x.Seat != null && EF.Functions.ILike(x.Seat, $"%{t}%")));
        }
        query = query.OrderByDescending(x => x.EntryTime);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<Dictionary<Guid, DateTime>> GetMostRecentCompletedExitAtByLibraryAsync(CancellationToken ct)
        => await DbSet
            .Where(x => x.Status == LibrarySessionStatus.Completed && x.ExitTime != null)
            .GroupBy(x => x.LibraryId)
            .Select(g => new { LibraryId = g.Key, LastExit = g.Max(x => x.ExitTime!.Value) })
            .ToDictionaryAsync(x => x.LibraryId, x => x.LastExit, ct);
}

public class LibraryQueueRepository(AppDbContext context) : Repository<LibraryQueueEntry>(context), ILibraryQueueRepository
{
    public async Task<PagedResult<LibraryQueueEntry>> GetPagedAsync(Guid libraryId, QueueListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.LibraryId == libraryId && (x.Status == "waiting" || x.Status == "called"))
            .OrderBy(x => x.JoinedAt);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<LibraryQueueEntry?> GetFrontWaitingAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == libraryId && x.Status == "waiting").OrderBy(x => x.JoinedAt).FirstOrDefaultAsync(ct);

    public async Task<LibraryQueueEntry?> GetActiveByParticipantAsync(Guid participantId, Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.ParticipantId == participantId && x.LibraryId == libraryId && (x.Status == "waiting" || x.Status == "called")).OrderBy(x => x.JoinedAt).FirstOrDefaultAsync(ct);

    public async Task<LibraryQueueEntry?> GetActiveByParticipantAnyAsync(Guid participantId, CancellationToken ct)
        => await DbSet.Where(x => x.ParticipantId == participantId && (x.Status == "waiting" || x.Status == "called")).OrderBy(x => x.JoinedAt).FirstOrDefaultAsync(ct);

    public async Task<List<LibraryQueueEntry>> GetActiveOrderedAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == libraryId && (x.Status == "waiting" || x.Status == "called")).OrderBy(x => x.JoinedAt).ToListAsync(ct);

    public async Task<bool> HasCalledAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.AnyAsync(x => x.LibraryId == libraryId && x.Status == "called", ct);

    public async Task<int> CountWaitingAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.LibraryId == libraryId && x.Status == "waiting", ct);

    public async Task<int> CountAllWaitingAsync(CancellationToken ct)
        => await DbSet.CountAsync(x => x.Status == "waiting", ct);

    public async Task<Dictionary<Guid, int>> CountWaitingByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct)
        => await DbSet
            .Where(x => libraryIds.Contains(x.LibraryId) && x.Status == "waiting")
            .GroupBy(x => x.LibraryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

    public async Task<int> CountTodayNoShowsAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.ParticipantId == participantId && x.LibraryId == libraryId && x.JoinedAt >= dayStart && x.Status == "expired", ct);

    public async Task<int> NextQueueSeqAsync(Guid libraryId, DateTime dayStart, CancellationToken ct)
    {
        var numbers = await DbSet.IgnoreQueryFilters()
            .Where(x => x.LibraryId == libraryId && x.JoinedAt >= dayStart)
            .Select(x => x.QueueNumber)
            .ToListAsync(ct);
        var max = 0;
        foreach (var n in numbers)
        {
            var digits = new string((n ?? "").Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var v) && v > max) max = v;
        }
        return max + 1;
    }

    public async Task<List<LibraryQueueEntry>> GetExpiredCalledAsync(DateTime now, CancellationToken ct)
        => await DbSet.Where(x => x.Status == "called" && x.CountdownExpiresAt != null && x.CountdownExpiresAt < now).ToListAsync(ct);

    public async Task<PagedResult<LibraryQueueEntry>> GetAllWaitingPagedAsync(AllLibrariesPersonListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.Status == "waiting" || x.Status == "called");
        if (scopedLibraryIds is not null)
            query = query.Where(x => scopedLibraryIds.Contains(x.LibraryId));
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.MemberName, $"%{t}%"));
        }
        query = query.OrderBy(x => x.JoinedAt);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }
}

public class LibraryBreakRepository(AppDbContext context) : Repository<LibraryBreak>(context), ILibraryBreakRepository
{
    public async Task<PagedResult<LibraryBreak>> GetActivePagedAsync(Guid libraryId, BreakListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.LibraryId == libraryId && x.Status == "active");
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.MemberName, $"%{t}%"));
        }
        query = query.OrderBy(x => x.ExpectedReturnAt);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<int> CountActiveAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.LibraryId == libraryId && x.Status == "active", ct);

    public async Task<LibraryBreak?> GetActiveBySessionAsync(Guid sessionId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.SessionId == sessionId && x.Status == "active", ct);

    public async Task<int> CountTodayBySessionTypeAsync(Guid sessionId, string type, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.SessionId == sessionId && x.Type == type && x.StartTime >= dayStart
            && (x.Status == "active" || x.EndTime == null || (x.EndTime.Value - x.StartTime) >= TimeSpan.FromSeconds(60)), ct);

    public async Task<int> CountTodayBySessionAsync(Guid sessionId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.SessionId == sessionId && x.StartTime >= dayStart, ct);

    public async Task<DateTime?> GetLastBreakStartTodayAsync(Guid sessionId, DateTime dayStart, CancellationToken ct)
        => await DbSet.Where(x => x.SessionId == sessionId && x.StartTime >= dayStart)
            .OrderByDescending(x => x.StartTime).Select(x => (DateTime?)x.StartTime).FirstOrDefaultAsync(ct);

    public async Task<DateTime?> GetLastBreakStartByTypeTodayAsync(Guid sessionId, string type, DateTime dayStart, CancellationToken ct)
        => await DbSet.Where(x => x.SessionId == sessionId && x.Type == type && x.StartTime >= dayStart)
            .OrderByDescending(x => x.StartTime).Select(x => (DateTime?)x.StartTime).FirstOrDefaultAsync(ct);

    public async Task<List<LibraryBreak>> GetBySessionAsync(Guid sessionId, CancellationToken ct)
        => await DbSet.Where(x => x.SessionId == sessionId).OrderBy(x => x.StartTime).ToListAsync(ct);

    public async Task<List<LibraryBreak>> GetExpiredGraceAsync(DateTime now, CancellationToken ct)
        => await DbSet.Where(x => x.Status == "active" && x.GraceUntil < now).ToListAsync(ct);

    public async Task<List<LibraryBreak>> GetActiveBreaksAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == "active").ToListAsync(ct);
}

public class LibraryReservationRepository(AppDbContext context) : Repository<LibraryReservation>(context), ILibraryReservationRepository
{
    public async Task<LibraryReservation?> GetActiveHoldByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.ParticipantId == participantId && x.Status == "held", ct);

    public async Task<List<LibraryReservation>> GetActiveHoldsByLibraryAsync(Guid libraryId, CancellationToken ct)
        => await DbSet.Where(x => x.LibraryId == libraryId && x.Status == "held").ToListAsync(ct);

    // HoldUntil süresi geçmiş "held" kayıtlar henüz LibraryMaintenanceJob tarafından
    // "expired" yapılmamış olabilir (job dakikada bir çalışır) — süresi dolmuş bir
    // "held" kaydı dolulukta sayılırsa koltuk gerçekte boşken dolu görünür. Bu yüzden
    // HoldUntil > now filtresi de eklendi (GetActiveHoldsByLibraryAsync ile aynı desen,
    // bkz. EnsureSeatAvailableAsync).
    public async Task<Dictionary<Guid, int>> CountHeldByLibrariesAsync(IReadOnlyCollection<Guid> libraryIds, CancellationToken ct)
        => await DbSet
            .Where(x => libraryIds.Contains(x.LibraryId) && x.Status == "held" && x.HoldUntil > DateTime.UtcNow)
            .GroupBy(x => x.LibraryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

    public async Task<LibraryReservation?> GetActiveHoldByTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Tckn == tckn && x.Status == "held", ct);

    public async Task<LibraryReservation?> GetHeldByTcknLibraryAsync(string tckn, Guid libraryId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Tckn == tckn && x.LibraryId == libraryId && x.Status == "held", ct);

    public async Task<int> CountTodayByParticipantLibraryAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.ParticipantId == participantId && x.LibraryId == libraryId && x.ReservedAt >= dayStart && x.Status != "cancelled" && x.Status != "expired", ct);

    public async Task<int> CountTodayNoShowsAsync(Guid participantId, Guid libraryId, DateTime dayStart, CancellationToken ct)
        => await DbSet.CountAsync(x => x.ParticipantId == participantId && x.LibraryId == libraryId && x.ReservedAt >= dayStart && x.Status == "expired", ct);

    public async Task<int> CountForfeitedByParticipantAsync(Guid participantId, Guid libraryId, DateTime? since, CancellationToken ct)
        => await DbSet.CountAsync(x => x.ParticipantId == participantId && x.LibraryId == libraryId
            && (x.Status == "cancelled" || x.Status == "expired")
            && (since == null || x.ReservedAt >= since), ct);

    public async Task<int> CountForfeitedByTcknAsync(string tckn, Guid libraryId, DateTime? since, CancellationToken ct)
        => await DbSet.CountAsync(x => x.Tckn == tckn && x.LibraryId == libraryId
            && (x.Status == "cancelled" || x.Status == "expired")
            && (since == null || x.ReservedAt >= since), ct);

    public async Task<List<LibraryReservation>> GetExpiredHoldsAsync(DateTime now, CancellationToken ct)
        => await DbSet.Where(x => x.Status == "held" && x.HoldUntil < now).ToListAsync(ct);

    public async Task<List<LibraryReservation>> GetActiveHoldsAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == "held").ToListAsync(ct);

    public async Task<PagedResult<LibraryReservation>> GetByParticipantAsync(Guid participantId, string? status, int page, int limit, CancellationToken ct, string? search = null)
    {
        var query = DbSet.Where(x => x.ParticipantId == participantId);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var s = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == s);
        }
        // Kullanıcı isteği (2026-09-23): mobil genel arama ekranı, giriş yapmış kullanıcının
        // kendi kütüphane rezervasyonlarını kıraathane adı üzerinden de eşleştirebilsin diye eklendi.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = LikeQuery.Escape(search.Trim());
            var matchingLibraryIds = Context.Set<Library>()
                .Where(l => EF.Functions.ILike(l.Name, $"%{term}%"))
                .Select(l => l.Id);
            query = query.Where(x => matchingLibraryIds.Contains(x.LibraryId));
        }
        query = query.OrderByDescending(x => x.ReservedAt);
        return await PaginateAsync(query, page, limit, ct);
    }
}
