using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Roles.Dtos;

namespace Nexora.Application.Features.Roles;

public interface IRoleService
{
    Task<PagedResult<RoleDto>> GetPagedAsync(RoleListParams p, CancellationToken ct);
    Task<RoleDetailDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<List<RoleOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<RoleDto> CreateAsync(CreateRoleRequest req, CancellationToken ct);
    Task<RoleDto> UpdateAsync(Guid id, UpdateRoleRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<RoleDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
