using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Departments.Dtos;
using Nexora.Domain.Entities.Organization;

namespace Nexora.Application.Common.Repositories;

public interface IDepartmentRepository : IRepository<Department>
{
    Task<PagedResult<Department>> GetPagedAsync(DepartmentListParams p, CancellationToken ct);
    Task<List<Department>> GetActiveAsync(CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
}
