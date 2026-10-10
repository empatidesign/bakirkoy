using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Public;
using Nexora.Application.Features.ServiceFacilities.Dtos;
using Nexora.Domain.Entities.ServiceFacilities;

namespace Nexora.Application.Common.Repositories;

public interface IServiceFacilityRepository : IRepository<ServiceFacility>
{
    Task<PagedResult<ServiceFacility>> GetPagedAsync(ServiceFacilityListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct);
    Task<List<ServiceFacility>> GetActiveOptionsAsync(IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct);
    Task<List<ServiceFacility>> GetPublicDiscoverAsync(PublicFacilityQuery q, CancellationToken ct);
    Task<ServiceFacilitySummaryDto> GetSummaryAsync(ServiceFacilityListParams p, CancellationToken ct);
    Task<List<ServiceFacility>> GetMapPointsAsync(CancellationToken ct);
    Task<HashSet<string>> GetExistingNamesAsync(CancellationToken ct);
}
