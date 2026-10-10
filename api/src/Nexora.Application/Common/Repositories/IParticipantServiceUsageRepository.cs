namespace Nexora.Application.Common.Repositories;

using Nexora.Domain.Entities.Participants;

public interface IParticipantServiceUsageRepository : IRepository<ParticipantServiceUsage>
{
    Task<ParticipantServiceUsage?> GetAsync(string module, Guid participantId, CancellationToken ct);
    Task<Dictionary<Guid, ParticipantServiceUsage>> GetByParticipantIdsAsync(string module, IReadOnlyCollection<Guid> participantIds, CancellationToken ct);
}
