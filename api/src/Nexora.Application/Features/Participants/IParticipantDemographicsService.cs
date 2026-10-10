using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Application.Features.Participants;

public interface IParticipantDemographicsService
{
    Task<ParticipantDemographicsOverviewDto> GetOverviewAsync(ParticipantDemographicsParams p, CancellationToken ct);
    Task<NeighborhoodDetailDto> GetNeighborhoodDetailAsync(string neighborhood, ParticipantDemographicsParams p, int page, int limit, CancellationToken ct);
}
