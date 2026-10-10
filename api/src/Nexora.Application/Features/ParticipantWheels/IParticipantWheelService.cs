using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantWheels.Dtos;

namespace Nexora.Application.Features.ParticipantWheels;

public interface IParticipantWheelService
{
    Task<PagedResult<CitizenWheelDto>> GetWheelsAsync(CitizenWheelListParams p, CancellationToken ct);
    Task<PagedResult<CitizenGiftRequestDto>> GetMyGiftsAsync(CitizenGiftRequestListParams p, CancellationToken ct);
    Task<AvailableGiftsResultDto> GetAvailableGiftsAsync(CancellationToken ct);
}
