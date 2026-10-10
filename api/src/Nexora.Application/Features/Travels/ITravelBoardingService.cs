using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelBoardingService
{
    Task<List<TravelBoardingBusDto>> GetBoardingManifestAsync(Guid travelId, CancellationToken ct);
}
