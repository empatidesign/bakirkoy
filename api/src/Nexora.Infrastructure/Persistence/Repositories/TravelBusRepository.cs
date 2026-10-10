using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelBusRepository(AppDbContext context)
    : Repository<TravelBus>(context), ITravelBusRepository
{
    private readonly AppDbContext _context = context;

    public async Task<PagedResult<TravelBus>> GetPagedAsync(TravelBusListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (p.TravelId.HasValue)
        {
            var assigned = await _context.Set<TravelBusAssignment>()
                .Where(a => a.TravelId == p.TravelId.Value)
                .Select(a => a.BusId)
                .ToListAsync(ct);
            query = query.Where(e => assigned.Contains(e.Id));
        }

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(e => EF.Functions.ILike(e.Name, $"%{term}%") || EF.Functions.ILike(e.PlateNumber, $"%{term}%"));
        }

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        query = p.Sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(e => e.Name) : query.OrderBy(e => e.Name),
            _ => query.OrderBy(e => e.Name),
        };

        return await PaginateAsync(query, p.Page ?? 1, p.Limit ?? 25, ct);
    }

    public async Task<List<TravelBus>> GetByTravelAsync(Guid travelId, CancellationToken ct)
    {
        var busIds = await _context.Set<TravelBusAssignment>()
            .Where(a => a.TravelId == travelId)
            .Select(a => a.BusId)
            .ToListAsync(ct);
        return await DbSet.Where(e => busIds.Contains(e.Id)).OrderBy(e => e.Name).ToListAsync(ct);
    }

    // Kullanıcı isteği (2026-08-05): bir araç (plaka/şoför), tarihleri çakışan başka
    // seferlere de serbestçe atanabilir — aynı araç birden fazla geziye aynı anda
    // tanımlanabilir, yalnızca kontenjan/koltuk sayısı önemlidir. Önceden burada
    // tarih çakışması olan araçlar listeden düşürülüyordu, artık tüm aktif araçlar
    // (startDate/endDate parametreleri artık kullanılmıyor, imza geriye dönük uyum için korunuyor).
    public async Task<List<TravelBus>> GetAvailableAsync(Guid? forTravelId, DateTime? startDate, DateTime? endDate, CancellationToken ct)
        => await DbSet.Where(e => e.IsActive).OrderBy(e => e.Name).ToListAsync(ct);

    public async Task<int> CountByTravelAsync(Guid travelId, CancellationToken ct)
        => await _context.Set<TravelBusAssignment>().CountAsync(a => a.TravelId == travelId, ct);

    public async Task<(int TotalBuses, int TotalCapacity, int TotalOccupied, int ActiveTravels)> GetSummaryAsync(Guid? travelId, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (travelId.HasValue)
        {
            var assigned = await _context.Set<TravelBusAssignment>()
                .Where(a => a.TravelId == travelId.Value)
                .Select(a => a.BusId)
                .ToListAsync(ct);
            query = query.Where(e => assigned.Contains(e.Id));
        }
        var totalBuses = await query.CountAsync(ct);
        var totalCapacity = await query.SumAsync(e => e.Capacity, ct);
        var totalOccupied = await query.SumAsync(e => e.OccupiedCount, ct);
        var activeTravels = await _context.Set<TravelBusAssignment>().Select(a => a.TravelId).Distinct().CountAsync(ct);
        return (totalBuses, totalCapacity, totalOccupied, activeTravels);
    }

    public async Task<List<TravelBusAssignment>> GetAssignmentsByTravelAsync(Guid travelId, CancellationToken ct)
        => await _context.Set<TravelBusAssignment>().Where(a => a.TravelId == travelId).ToListAsync(ct);

    public async Task<TravelBusAssignment?> GetAssignmentAsync(Guid travelId, Guid busId, CancellationToken ct)
        => await _context.Set<TravelBusAssignment>().FirstOrDefaultAsync(a => a.TravelId == travelId && a.BusId == busId, ct);

    public async Task AddAssignmentAsync(Guid travelId, Guid busId, string? seatStatesJson, CancellationToken ct)
        => await _context.Set<TravelBusAssignment>().AddAsync(new TravelBusAssignment { TravelId = travelId, BusId = busId, SeatStatesJson = seatStatesJson }, ct);

    public async Task RemoveAssignmentsByBusForTravelAsync(Guid travelId, List<Guid> busIds, CancellationToken ct)
    {
        var rows = await _context.Set<TravelBusAssignment>()
            .Where(a => a.TravelId == travelId && busIds.Contains(a.BusId))
            .ToListAsync(ct);
        _context.Set<TravelBusAssignment>().RemoveRange(rows);
    }

    public async Task<List<TravelBusAssignment>> GetUpcomingAssignmentsForBusAsync(Guid busId, DateTime fromDateUtc, CancellationToken ct)
    {
        var from = fromDateUtc.Date;
        var travelIds = await _context.Set<Travel>()
            .Where(t => !t.IsDeleted && t.StartDate.Date >= from)
            .Select(t => t.Id)
            .ToListAsync(ct);
        return await _context.Set<TravelBusAssignment>()
            .Where(a => a.BusId == busId && travelIds.Contains(a.TravelId))
            .ToListAsync(ct);
    }

    public async Task<List<TravelBusAssignment>> GetAllAssignmentsForBusesAsync(List<Guid> busIds, CancellationToken ct)
        => await _context.Set<TravelBusAssignment>().Where(a => busIds.Contains(a.BusId)).ToListAsync(ct);

    public async Task<List<TravelBus>> GetBySourceBusIdAsync(Guid sourceBusId, CancellationToken ct)
        => await DbSet.Where(b => b.SourceBusId == sourceBusId).ToListAsync(ct);

    public async Task<Dictionary<Guid, string?>> GetNearestTravelNamesAsync(IEnumerable<Guid> busIds, CancellationToken ct)
    {
        var ids = busIds.ToList();
        if (ids.Count == 0) return [];
        var today = TurkeyTime.TodayDate();
        var entries = await _context.Set<TravelBusAssignment>()
            .Where(a => ids.Contains(a.BusId))
            .Join(
                _context.Set<Travel>().Where(t => !t.IsDeleted && t.StartDate.Date >= today),
                a => a.TravelId,
                t => t.Id,
                (a, t) => new { a.BusId, t.Name, t.StartDate })
            .ToListAsync(ct);

        return entries
            .GroupBy(x => x.BusId)
            .ToDictionary(g => g.Key, g => (string?)g.OrderBy(x => x.StartDate).First().Name);
    }

    public async Task RemoveAssignmentsForBusAsync(Guid busId, CancellationToken ct)
    {
        var rows = await _context.Set<TravelBusAssignment>().Where(a => a.BusId == busId).ToListAsync(ct);
        _context.Set<TravelBusAssignment>().RemoveRange(rows);
    }
}
