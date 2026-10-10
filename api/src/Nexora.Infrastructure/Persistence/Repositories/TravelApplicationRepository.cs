using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelApplicationRepository(AppDbContext context)
    : Repository<TravelApplication>(context), ITravelApplicationRepository
{
    public async Task<PagedResult<TravelApplication>> GetPagedAsync(TravelApplicationListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.AsQueryable(), p);

        var desc = !string.Equals(p.Order, "asc", StringComparison.OrdinalIgnoreCase);
        query = p.Sort?.ToLowerInvariant() switch
        {
            "applicationdate" => desc ? query.OrderByDescending(e => e.ApplicationDate) : query.OrderBy(e => e.ApplicationDate),
            "participantname" => desc
                ? query.OrderByDescending(e => Context.Set<Participant>().Where(pt => pt.Id == e.ParticipantId).Select(pt => pt.FullName).FirstOrDefault())
                : query.OrderBy(e => Context.Set<Participant>().Where(pt => pt.Id == e.ParticipantId).Select(pt => pt.FullName).FirstOrDefault()),
            "neighborhood" => desc
                ? query.OrderByDescending(e => Context.Set<Participant>().Where(pt => pt.Id == e.ParticipantId).Select(pt => pt.Neighborhood).FirstOrDefault())
                : query.OrderBy(e => Context.Set<Participant>().Where(pt => pt.Id == e.ParticipantId).Select(pt => pt.Neighborhood).FirstOrDefault()),
            "travelstartdate" => desc
                ? query.OrderByDescending(e => Context.Set<Travel>().Where(t => t.Id == e.TravelId).Select(t => t.StartDate).FirstOrDefault())
                : query.OrderBy(e => Context.Set<Travel>().Where(t => t.Id == e.TravelId).Select(t => t.StartDate).FirstOrDefault()),
            _ => query.OrderByDescending(e => e.ApplicationDate),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<TravelApplication?> GetWithPassengersAsync(Guid id, CancellationToken ct)
        => await DbSet.Include(e => e.Passengers).FirstOrDefaultAsync(e => e.Id == id, ct);

    public async Task<List<TravelApplication>> GetForExportAsync(TravelApplicationListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.Include(e => e.Passengers).AsQueryable(), p);
        return await query.OrderByDescending(e => e.ApplicationDate).ToListAsync(ct);
    }

    private IQueryable<TravelApplication> ApplyFilters(IQueryable<TravelApplication> query, TravelApplicationListParams p)
    {
        if (p.TravelId.HasValue) query = query.Where(e => e.TravelId == p.TravelId.Value);
        if (!string.IsNullOrWhiteSpace(p.Status)) query = query.Where(e => e.Status == p.Status);
        if (p.StartDate.HasValue) query = query.Where(e => e.ApplicationDate >= p.StartDate.Value);
        if (p.EndDate.HasValue) query = query.Where(e => e.ApplicationDate <= p.EndDate.Value);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            var participantIds = Context.Set<Participant>()
                .Where(pt => EF.Functions.ILike(pt.FullName, $"%{term}%")
                    || pt.Tckn.Contains(term)
                    || (pt.Phone != null && pt.Phone.Contains(term))
                    || (pt.Email != null && EF.Functions.ILike(pt.Email, $"%{term}%")))
                .Select(pt => pt.Id);
            query = query.Where(e => participantIds.Contains(e.ParticipantId) || EF.Functions.ILike(e.Code, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Neighborhood))
        {
            var neighborhoodParticipantIds = Context.Set<Participant>()
                .Where(pt => pt.Neighborhood == p.Neighborhood)
                .Select(pt => pt.Id);
            query = query.Where(e => neighborhoodParticipantIds.Contains(e.ParticipantId));
        }

        if (!string.IsNullOrWhiteSpace(p.PaymentStatus)) query = query.Where(e => e.PaymentStatus == p.PaymentStatus);

        if (p.Gender is "male" or "female")
        {
            var gender = p.Gender == "female" ? Gender.Female : Gender.Male;
            var genderParticipantIds = Context.Set<Participant>()
                .Where(pt => pt.Gender == gender)
                .Select(pt => pt.Id);
            query = query.Where(e => genderParticipantIds.Contains(e.ParticipantId));
        }

        return query;
    }

    public async Task<(int Total, int Approved, int Reviewing, int Rejected, int Waitlist)> GetSummaryAsync(Guid? travelId, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (travelId.HasValue) query = query.Where(e => e.TravelId == travelId.Value);
        var agg = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Approved = g.Count(e => e.Status == "approved"),
                Reviewing = g.Count(e => e.Status == "reviewing"),
                Rejected = g.Count(e => e.Status == "rejected"),
                Waitlist = g.Count(e => e.Status == "waitlist"),
            })
            .FirstOrDefaultAsync(ct);
        return agg is null
            ? (0, 0, 0, 0, 0)
            : (agg.Total, agg.Approved, agg.Reviewing, agg.Rejected, agg.Waitlist);
    }

    public async Task<Dictionary<Guid, (int Approved, int Waitlist)>> CountByTravelsAsync(IReadOnlyCollection<Guid> travelIds, CancellationToken ct)
    {
        if (travelIds.Count == 0) return new();
        // Match CountByTravelAndStatusAsync: an application without passenger rows still
        // occupies one place; otherwise count all passengers, including companions.
        var rows = await DbSet
            .Where(a => travelIds.Contains(a.TravelId) && (a.Status == "approved" || a.Status == "waitlist"))
            .Select(a => new
            {
                a.TravelId, a.Status,
                Passengers = Context.Set<TravelApplicationPassenger>().Count(p => p.ApplicationId == a.Id)
            }).ToListAsync(ct);
        return rows.GroupBy(a => a.TravelId).ToDictionary(g => g.Key, g => (
            g.Where(a => a.Status == "approved").Sum(a => Math.Max(a.Passengers, 1)),
            g.Where(a => a.Status == "waitlist").Sum(a => Math.Max(a.Passengers, 1))));
    }

    public async Task<int> CountByTravelAndStatusAsync(Guid travelId, string status, CancellationToken ct)
    {
        var apps = await DbSet
            .Where(a => a.TravelId == travelId && a.Status == status)
            .Select(a => new { a.Id })
            .ToListAsync(ct);
        if (apps.Count == 0) return 0;

        var appIds = apps.Select(a => a.Id).ToList();
        var passengerCounts = await Context.Set<TravelApplicationPassenger>()
            .Where(p => appIds.Contains(p.ApplicationId))
            .GroupBy(p => p.ApplicationId)
            .Select(g => new { ApplicationId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ApplicationId, x => x.Count, ct);

        return apps.Sum(a => Math.Max(passengerCounts.GetValueOrDefault(a.Id, 0), 1));
    }

    public async Task<TravelApplication?> GetOldestWaitlistAsync(Guid travelId, CancellationToken ct)
        => await DbSet.Where(e => e.TravelId == travelId && e.Status == "waitlist")
            .OrderBy(e => e.ApplicationDate).FirstOrDefaultAsync(ct);

    public async Task<List<TravelApplication>> GetWaitlistOrderedAsync(Guid travelId, CancellationToken ct)
        => await DbSet.Where(e => e.TravelId == travelId && e.Status == "waitlist")
            .OrderBy(e => e.ApplicationDate).ThenBy(e => e.Id).ToListAsync(ct);

    public async Task<int> CountActiveByParticipantInTravelWindowAsync(Guid participantId, DateTime start, DateTime end, Guid? excludeTravelId, CancellationToken ct)
    {
        var tckn = await Context.Set<Participant>()
            .Where(p => p.Id == participantId)
            .Select(p => p.Tckn)
            .FirstOrDefaultAsync(ct);

        return await DbSet
            .Join(Context.Set<Travel>(), a => a.TravelId, t => t.Id, (a, t) => new { App = a, Travel = t })
            .CountAsync(x =>
                (x.App.ParticipantId == participantId && !x.App.IsGuest
                 || x.App.IsGuest && tckn != null && x.App.GuestTckn == tckn)
                && x.App.Status != "rejected"
                && x.App.Status != "cancelled"
                && !x.Travel.ExemptFromParticipationLimit
                && x.Travel.ParticipationPeriod != "unlimited"
                && x.Travel.StartDate >= start
                && x.Travel.StartDate < end
                && (excludeTravelId == null || x.App.TravelId != excludeTravelId), ct);
    }

    public async Task<int> CountActiveByGuestTcknInTravelWindowAsync(string tckn, DateTime start, DateTime end, Guid? excludeTravelId, CancellationToken ct)
    {
        var participantId = await Context.Set<Participant>()
            .Where(p => p.Tckn == tckn)
            .Select(p => (Guid?)p.Id)
            .FirstOrDefaultAsync(ct);

        return await DbSet
            .Join(Context.Set<Travel>(), a => a.TravelId, t => t.Id, (a, t) => new { App = a, Travel = t })
            .CountAsync(x =>
                (x.App.IsGuest && x.App.GuestTckn == tckn
                 || !x.App.IsGuest && participantId != null && x.App.ParticipantId == participantId)
                && x.App.Status != "rejected"
                && x.App.Status != "cancelled"
                && !x.Travel.ExemptFromParticipationLimit
                && x.Travel.ParticipationPeriod != "unlimited"
                && x.Travel.StartDate >= start
                && x.Travel.StartDate < end
                && (excludeTravelId == null || x.App.TravelId != excludeTravelId), ct);
    }

    public async Task<int> NextCodeNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('travel_application_code_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<List<TravelApplication>> GetActiveByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.Where(e => e.ParticipantId == participantId && e.Status != "rejected" && e.Status != "cancelled").ToListAsync(ct);

    public async Task<List<TravelApplication>> GetActiveByGuestTcknAsync(string tckn, CancellationToken ct)
        => await DbSet.Where(e => e.IsGuest && e.GuestTckn == tckn && e.Status != "rejected" && e.Status != "cancelled").ToListAsync(ct);

    public async Task<PagedResult<TravelApplication>> GetByParticipantsAsync(List<Guid> participantIds, string? status, string? period, int page, int limit, CancellationToken ct, string? search = null)
    {
        if (participantIds.Count == 0)
            return new PagedResult<TravelApplication> { Items = [], Total = 0, Page = page, Limit = limit };

        var query = DbSet.Where(e => participantIds.Contains(e.ParticipantId));
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(e => e.Status == status);

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
            {
                var matchingIds = Context.Set<Travel>()
                    .Where(t => t.StartDate >= from && t.StartDate < to)
                    .Select(t => t.Id);
                query = query.Where(a => matchingIds.Contains(a.TravelId));
            }
        }

        // Kullanıcı isteği (2026-09-23): mobil genel arama ekranı, giriş yapmış kullanıcının
        // kendi gezi başvurularını gezi adı/hedef üzerinden de eşleştirebilsin diye eklendi.
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = LikeQuery.Escape(search.Trim());
            var matchingTravelIds = Context.Set<Travel>()
                .Where(t => EF.Functions.ILike(t.Name, $"%{term}%") || EF.Functions.ILike(t.Destination, $"%{term}%"))
                .Select(t => t.Id);
            query = query.Where(a => matchingTravelIds.Contains(a.TravelId));
        }

        var todayUtc = TurkeyTime.TodayDate();
        var sorted = query
            .Join(Context.Set<Travel>(), a => a.TravelId, t => t.Id, (a, t) => new { App = a, t.StartDate })
            .OrderBy(x => x.StartDate >= todayUtc ? 0 : 1)
            .ThenBy(x => x.StartDate >= todayUtc ? x.StartDate : DateTime.MaxValue)
            .ThenByDescending(x => x.StartDate < todayUtc ? x.StartDate : DateTime.MinValue)
            .ThenBy(x => x.App.ApplicationDate)
            .Select(x => x.App);

        return await PaginateAsync(sorted, page, limit, ct);
    }

    public async Task<List<Guid>> GetParticipantIdsByTravelsAsync(IReadOnlyCollection<Guid> travelIds, CancellationToken ct)
    {
        if (travelIds.Count == 0) return [];
        var appIds = await DbSet.Where(a => travelIds.Contains(a.TravelId)).Select(a => a.Id).ToListAsync(ct);
        if (appIds.Count == 0) return [];
        var applicants = await DbSet
            .Where(a => appIds.Contains(a.Id))
            .Select(a => a.ParticipantId)
            .ToListAsync(ct);
        var passengers = await Context.Set<TravelApplicationPassenger>()
            .Where(x => appIds.Contains(x.ApplicationId) && x.Status == "active")
            .Select(x => x.ParticipantId)
            .ToListAsync(ct);
        return applicants.Concat(passengers).Distinct().ToList();
    }

    public async Task<List<TravelApplication>> GetActiveByParticipantsAndTravelAsync(List<Guid> participantIds, Guid travelId, CancellationToken ct)
        => await DbSet
            .Where(e => e.TravelId == travelId && participantIds.Contains(e.ParticipantId) && e.Status != "rejected" && e.Status != "cancelled")
            .ToListAsync(ct);

    public async Task<int> CountActiveChildrenOnTravelAsync(Guid travelId, IReadOnlyCollection<Guid> childParticipantIds, IReadOnlyCollection<Guid> excludeApplicationIds, CancellationToken ct)
    {
        if (childParticipantIds.Count == 0) return 0;
        var childIds = childParticipantIds.ToList();
        var excluded = excludeApplicationIds.ToList();
        var activeAppIds = await DbSet
            .Where(a => a.TravelId == travelId && a.Status != "rejected" && a.Status != "cancelled" && !excluded.Contains(a.Id))
            .Select(a => a.Id)
            .ToListAsync(ct);
        if (activeAppIds.Count == 0) return 0;
        return await Context.Set<TravelApplicationPassenger>()
            .Where(p => p.Status == "active" && childIds.Contains(p.ParticipantId) && activeAppIds.Contains(p.ApplicationId))
            .Select(p => p.ParticipantId)
            .Distinct()
            .CountAsync(ct);
    }

    public async Task<List<TravelApplicationPassenger>> GetPassengersByBusAsync(Guid busId, CancellationToken ct)
        => await Context.Set<TravelApplicationPassenger>()
            .Where(x => x.BusId == busId && x.Status == "active")
            .ToListAsync(ct);

    public async Task<List<TravelApplicationPassenger>> GetSeatedPassengersAsync(Guid travelId, Guid busId, CancellationToken ct)
    {
        var appIds = await DbSet
            .Where(a => a.TravelId == travelId && a.Status != "rejected" && a.Status != "cancelled")
            .Select(a => a.Id).ToListAsync(ct);
        return await Context.Set<TravelApplicationPassenger>()
            .Where(x => x.BusId == busId && x.Status == "active" && x.SeatNumber != null && appIds.Contains(x.ApplicationId))
            .ToListAsync(ct);
    }

    public async Task<List<TravelApplicationPassenger>> GetActivePassengersByBusAsync(Guid travelId, Guid busId, CancellationToken ct)
    {
        var appIds = await DbSet.Where(a => a.TravelId == travelId).Select(a => a.Id).ToListAsync(ct);
        return await Context.Set<TravelApplicationPassenger>()
            .Where(x => x.BusId == busId && x.Status == "active" && appIds.Contains(x.ApplicationId))
            .ToListAsync(ct);
    }

    public async Task<List<SeatedPassengerNameDto>> GetSeatedPassengerNamesAsync(Guid travelId, Guid busId, CancellationToken ct)
    {
        var appIds = await DbSet.Where(a => a.TravelId == travelId).Select(a => a.Id).ToListAsync(ct);
        var seated = await Context.Set<TravelApplicationPassenger>()
            .Where(x => x.BusId == busId && x.Status == "active" && x.SeatNumber != null && appIds.Contains(x.ApplicationId))
            .ToListAsync(ct);
        var participantIds = seated.Select(x => x.ParticipantId).Distinct().ToList();
        var participants = await Context.Set<Participant>()
            .Where(p => participantIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.FullName, ct);
        return seated
            .Where(x => participants.ContainsKey(x.ParticipantId))
            .Select(x => new SeatedPassengerNameDto(x.SeatNumber!, participants[x.ParticipantId], x.Gender))
            .ToList();
    }

    public async Task<bool> IsSeatTakenAsync(Guid busId, string seatNumber, Guid? excludePassengerId, CancellationToken ct)
        => await Context.Set<TravelApplicationPassenger>()
            .AnyAsync(x => x.BusId == busId && x.SeatNumber == seatNumber && x.Status == "active"
                && (!excludePassengerId.HasValue || x.Id != excludePassengerId.Value), ct);

    public async Task<bool> AnyApprovedByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet.AnyAsync(x => x.ParticipantId == participantId && x.Status == "approved", ct);

    public async Task<List<string>> GetDistinctNeighborhoodsAsync(Guid? travelId, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (travelId.HasValue) query = query.Where(e => e.TravelId == travelId.Value);
        var participantIds = await query.Select(e => e.ParticipantId).Distinct().ToListAsync(ct);
        if (participantIds.Count == 0) return [];
        return await Context.Set<Participant>()
            .Where(p => participantIds.Contains(p.Id) && p.Neighborhood != null && p.Neighborhood != "")
            .Select(p => p.Neighborhood!)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync(ct);
    }
}
