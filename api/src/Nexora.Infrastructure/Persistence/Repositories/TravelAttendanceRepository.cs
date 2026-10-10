using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelAttendanceRepository(AppDbContext context)
    : Repository<TravelAttendance>(context), ITravelAttendanceRepository
{
    public async Task<List<TravelAttendance>> GetByTravelAsync(Guid travelId, CancellationToken ct)
        => await DbSet.Where(x => x.TravelId == travelId).ToListAsync(ct);

    public async Task<TravelAttendance?> GetMostRecentPastByParticipantAsync(Guid participantId, DateTime beforeUtc, CancellationToken ct)
        => await DbSet
            .Join(Context.Set<Travel>(), a => a.TravelId, t => t.Id, (a, t) => new { Attendance = a, Travel = t })
            .Where(x => x.Attendance.ParticipantId == participantId && x.Travel.StartDate < beforeUtc)
            .OrderByDescending(x => x.Travel.StartDate)
            .Select(x => x.Attendance)
            .FirstOrDefaultAsync(ct);

    public async Task<Dictionary<Guid, DateTime>> GetMostRecentPresentMarkedAtByTravelAsync(CancellationToken ct)
        => await DbSet
            .Where(a => a.Status == "present" || a.Status == "late")
            .GroupBy(a => a.TravelId)
            .Select(g => new { TravelId = g.Key, LastAt = g.Max(a => a.MarkedAt) })
            .ToDictionaryAsync(x => x.TravelId, x => x.LastAt, ct);
}
