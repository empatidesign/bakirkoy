using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Reviews;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EventReviewRepository(AppDbContext context)
    : Repository<EventReview>(context), IEventReviewRepository
{
    public Task<List<EventReview>> GetByEventIdAsync(Guid eventId, CancellationToken ct)
        => DbSet.Where(r => r.EventId == eventId).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public Task<bool> ExistsByParticipantAsync(Guid eventId, Guid participantId, CancellationToken ct)
        => DbSet.AnyAsync(r => r.EventId == eventId && r.ParticipantId == participantId, ct);

    public async Task<HashSet<Guid>> GetReviewedEventIdsAsync(Guid participantId, List<Guid> eventIds, CancellationToken ct)
    {
        var ids = await DbSet
            .Where(r => r.ParticipantId == participantId && eventIds.Contains(r.EventId))
            .Select(r => r.EventId)
            .ToListAsync(ct);
        return new HashSet<Guid>(ids);
    }
}
