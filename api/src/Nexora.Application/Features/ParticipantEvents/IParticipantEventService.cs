using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.ParticipantEvents.Dtos;

namespace Nexora.Application.Features.ParticipantEvents;

public interface IParticipantEventService
{
    Task<PagedResult<CitizenEventDto>> DiscoverAsync(CitizenDiscoverParams p, CancellationToken ct);
    Task<CitizenEventDetailDto> GetDetailAsync(Guid eventId, CancellationToken ct);
    Task<SeatMapDto> GetSeatMapAsync(Guid eventId, Guid? sessionId, CancellationToken ct);
    Task<CitizenApplicationDto> ApplyAsync(Guid eventId, CitizenApplyRequest req, CancellationToken ct);
    Task<PagedResult<CitizenApplicationDto>> GetApplicationsAsync(CitizenApplicationListParams p, CancellationToken ct);
    Task CancelApplicationAsync(Guid applicationId, CancellationToken ct);
    Task<ActivityDto> CheckInAsync(Guid eventId, CitizenCheckInRequest req, CancellationToken ct);
}
