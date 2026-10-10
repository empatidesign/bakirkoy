using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelRouteService
{
    Task<PagedResult<TravelRouteDto>> GetPagedAsync(TravelRouteListParams p, CancellationToken ct);
    Task<List<TravelRouteOptionDto>> GetOptionsAsync(string? search, CancellationToken ct);
    Task<TravelRouteDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TravelRouteDto> CreateAsync(TravelRouteFormRequest req, CancellationToken ct);
    Task<TravelRouteDto> UpdateAsync(Guid id, TravelRouteFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<TravelRouteDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<PagedResult<TravelDto>> GetTravelsAsync(Guid routeId, TravelListParams p, CancellationToken ct);
}
