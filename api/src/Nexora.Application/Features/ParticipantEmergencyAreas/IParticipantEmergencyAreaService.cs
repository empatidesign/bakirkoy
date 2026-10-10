using Nexora.Application.Features.ParticipantEmergencyAreas.Dtos;

namespace Nexora.Application.Features.ParticipantEmergencyAreas;

public interface IParticipantEmergencyAreaService
{
    Task<List<CitizenEmergencyAreaDto>> GetListAsync(CancellationToken ct);
    Task<CitizenEmergencyAreaDto> GetDetailAsync(Guid id, CancellationToken ct);
}
