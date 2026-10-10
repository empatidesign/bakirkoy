using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ParticipantServiceUsageRepository(AppDbContext context)
    : Repository<ParticipantServiceUsage>(context), IParticipantServiceUsageRepository
{
    public async Task<ParticipantServiceUsage?> GetAsync(string module, Guid participantId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Module == module && x.ParticipantId == participantId, ct);

    public async Task<Dictionary<Guid, ParticipantServiceUsage>> GetByParticipantIdsAsync(
        string module, IReadOnlyCollection<Guid> participantIds, CancellationToken ct)
        => await DbSet
            .Where(x => x.Module == module && participantIds.Contains(x.ParticipantId))
            .ToDictionaryAsync(x => x.ParticipantId, ct);
}
