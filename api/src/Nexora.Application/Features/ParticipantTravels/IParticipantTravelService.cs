using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantAuth.Dtos;
using Nexora.Application.Features.ParticipantTravels.Dtos;

namespace Nexora.Application.Features.ParticipantTravels;

public interface IParticipantTravelService
{
    Task<PagedResult<CitizenTravelDto>> DiscoverAsync(CitizenTravelDiscoverParams p, CancellationToken ct);
    Task<CitizenTravelDetailDto> GetDetailAsync(Guid travelId, CancellationToken ct);
    Task<List<CitizenTravelBusSeatMapDto>> GetSeatMapAsync(Guid travelId, CancellationToken ct);
    Task<CitizenNviLookupResultDto> GuestLookupAsync(CitizenTravelGuestLookupRequest req, CancellationToken ct);
    Task<CitizenTravelApplicationDto> ReserveAsync(Guid travelId, CitizenTravelReserveRequest req, CancellationToken ct);
    Task<PagedResult<CitizenTravelApplicationDto>> GetApplicationsAsync(CitizenTravelApplicationListParams p, CancellationToken ct);
    Task CancelApplicationAsync(Guid applicationId, CancellationToken ct);
}
