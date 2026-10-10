using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Application.Common.Repositories;

public interface ISedaSchoolRepository : IRepository<SedaSchool>
{
    Task<PagedResult<SedaSchool>> GetPagedAsync(SedaSchoolListParams p, CancellationToken ct);
    Task<List<SedaSchool>> GetActiveAsync(CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
}
