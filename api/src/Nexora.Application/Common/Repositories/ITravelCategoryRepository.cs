using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelCategoryRepository : IRepository<TravelCategory>
{
    Task<PagedResult<TravelCategory>> GetPagedAsync(TravelCategoryListParams p, CancellationToken ct);
    Task<List<TravelCategory>> GetActiveAsync(CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
}
