using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface IServiceCategoryRepository : IRepository<ServiceCategory>
{
    Task<PagedResult<ServiceCategory>> GetPagedAsync(ServiceCategoryListParams p, CancellationToken ct);
    Task<List<ServiceCategory>> GetActiveAsync(CancellationToken ct);
    Task<List<ServiceCategory>> GetByIdsAsync(List<Guid> ids, CancellationToken ct);
    Task<ServiceCategory?> GetByNameAsync(string name, CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
    Task<int> CountCompaniesAsync(Guid categoryId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountCompaniesByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct);
}
