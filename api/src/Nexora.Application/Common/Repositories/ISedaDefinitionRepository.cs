using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Application.Common.Repositories;

public interface ISedaDefinitionRepository : IRepository<SedaDefinition>
{
    Task<PagedResult<SedaDefinition>> GetPagedAsync(SedaDefinitionListParams p, CancellationToken ct);
    Task<List<SedaDefinition>> GetActiveByTypeAsync(string type, CancellationToken ct);
    Task<bool> ExistsByNameAsync(string type, string name, Guid? excludeId, CancellationToken ct);
}
