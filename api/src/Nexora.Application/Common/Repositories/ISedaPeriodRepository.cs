using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Application.Common.Repositories;

public interface ISedaPeriodRepository : IRepository<SedaPeriod>
{
    Task<PagedResult<SedaPeriod>> GetPagedAsync(SedaPeriodListParams p, CancellationToken ct);
    Task<SedaPeriod?> GetActiveAsync(CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
}
