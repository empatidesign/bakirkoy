using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Reviews;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelReviewRepository(AppDbContext context)
    : Repository<TravelReview>(context), ITravelReviewRepository
{
    public Task<List<TravelReview>> GetByTravelIdAsync(Guid travelId, CancellationToken ct)
        => DbSet.Where(r => r.TravelId == travelId).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);

    public Task<bool> ExistsByParticipantAsync(Guid travelId, Guid participantId, CancellationToken ct)
        => DbSet.AnyAsync(r => r.TravelId == travelId && r.ParticipantId == participantId, ct);

    public async Task<HashSet<Guid>> GetReviewedTravelIdsAsync(Guid participantId, List<Guid> travelIds, CancellationToken ct)
    {
        var ids = await DbSet
            .Where(r => r.ParticipantId == participantId && travelIds.Contains(r.TravelId))
            .Select(r => r.TravelId)
            .ToListAsync(ct);
        return new HashSet<Guid>(ids);
    }
}
