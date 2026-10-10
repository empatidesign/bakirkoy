using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.EmergencyAreas.Dtos;

namespace Nexora.Application.Features.EmergencyAreas;

public interface IEmergencyAreaService
{
    Task<PagedResult<EmergencyAreaDto>> GetPagedAsync(EmergencyAreaListParams p, CancellationToken ct);
    Task<EmergencyAreaSummaryDto> GetSummaryAsync(EmergencyAreaListParams p, CancellationToken ct);
    Task<IReadOnlyList<EmergencyAreaMapPointDto>> GetMapPointsAsync(CancellationToken ct);
    Task<IReadOnlyList<EmergencyAreaOptionDto>> GetNeighborhoodOptionsAsync(CancellationToken ct);
    Task<EmergencyAreaDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<EmergencyAreaDto> CreateAsync(EmergencyAreaRequest req, CancellationToken ct);
    Task<EmergencyAreaDto> UpdateAsync(Guid id, EmergencyAreaRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<EmergencyAreaDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
