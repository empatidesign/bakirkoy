using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.EmergencyAreas.Dtos;
using Nexora.Domain.Entities.EmergencyAreas;

namespace Nexora.Application.Common.Repositories;

public interface IEmergencyAreaRepository : IRepository<EmergencyArea>
{
    Task<PagedResult<EmergencyArea>> GetPagedAsync(EmergencyAreaListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct);
    Task<EmergencyAreaSummaryDto> GetSummaryAsync(EmergencyAreaListParams p, CancellationToken ct);
    Task<List<EmergencyArea>> GetMapPointsAsync(CancellationToken ct);
    Task<List<EmergencyArea>> GetActiveAsync(CancellationToken ct);
}
