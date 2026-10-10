using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants;

public interface IParticipantEventHistoryService
{
    Task<ParticipantEventResultDto> GetListAsync(ParticipantEventListParams p, CancellationToken ct);
}
