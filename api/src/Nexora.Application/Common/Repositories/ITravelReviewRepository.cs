using Nexora.Domain.Entities.Reviews;

namespace Nexora.Application.Common.Repositories;

public interface ITravelReviewRepository : IRepository<TravelReview>
{
    Task<List<TravelReview>> GetByTravelIdAsync(Guid travelId, CancellationToken ct);
    Task<bool> ExistsByParticipantAsync(Guid travelId, Guid participantId, CancellationToken ct);
    Task<HashSet<Guid>> GetReviewedTravelIdsAsync(Guid participantId, List<Guid> travelIds, CancellationToken ct);
}
