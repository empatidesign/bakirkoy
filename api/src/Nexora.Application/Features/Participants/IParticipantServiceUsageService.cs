using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants;

public interface IParticipantServiceUsageService
{
    Task<ParticipantServiceUsageDto?> GetAsync(string module, Guid participantId, CancellationToken ct);

    Task<Dictionary<Guid, ParticipantServiceUsageDto>> GetManyAsync(string module, IReadOnlyCollection<Guid> participantIds, CancellationToken ct);

    Task<ParticipantServiceUsageDto> SetAsync(string module, Guid participantId, SetParticipantServiceUsageRequest req, string? actor, CancellationToken ct);

    Task RemoveAsync(string module, Guid participantId, string? actor, CancellationToken ct);
}
