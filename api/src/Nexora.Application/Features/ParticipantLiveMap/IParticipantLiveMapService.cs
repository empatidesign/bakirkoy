using Nexora.Application.Features.ParticipantLiveMap.Dtos;

namespace Nexora.Application.Features.ParticipantLiveMap;

public interface IParticipantLiveMapService
{
    Task<LiveMapResultDto> GetLiveMapAsync(CancellationToken ct);
}
