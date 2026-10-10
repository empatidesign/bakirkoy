using Nexora.Domain.Entities.Reviews;

namespace Nexora.Application.Common.Repositories;

public interface IEventReviewRepository : IRepository<EventReview>
{
    Task<List<EventReview>> GetByEventIdAsync(Guid eventId, CancellationToken ct);
    Task<bool> ExistsByParticipantAsync(Guid eventId, Guid participantId, CancellationToken ct);
    Task<HashSet<Guid>> GetReviewedEventIdsAsync(Guid participantId, List<Guid> eventIds, CancellationToken ct);
}
