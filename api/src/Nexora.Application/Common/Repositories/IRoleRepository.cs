using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Roles.Dtos;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Application.Common.Repositories;

public interface IRoleRepository : IRepository<Role>
{
    Task<PagedResult<Role>> GetPagedAsync(RoleListParams p, CancellationToken ct);
    Task<List<Role>> GetActiveAsync(CancellationToken ct);
    Task<Role?> GetByKeyAsync(string key, CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
}
