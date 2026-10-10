using Nexora.Domain.Entities.Facilities;
namespace Nexora.Application.Common.Repositories;

public interface IFacilityMasterAccessLogRepository : IRepository<FacilityMasterAccessLog>
{
    Task<List<FacilityMasterAccessLog>> GetRecentAsync(Guid serviceFacilityId, int take, CancellationToken ct);
}
