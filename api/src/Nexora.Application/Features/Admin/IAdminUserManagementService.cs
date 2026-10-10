using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Admin.Dtos;

namespace Nexora.Application.Features.Admin;

public interface IAdminUserManagementService
{
    Task<PagedResult<AdminUserDto>> GetPagedAsync(AdminListParams p, CancellationToken ct);
    Task<AdminUserDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<AdminUserDto> CreateAsync(CreateAdminRequest req, CancellationToken ct);
    Task<AdminUserDto> UpdateAsync(Guid id, UpdateAdminRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<AdminUserDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task SendPasswordResetAsync(Guid id, SendPasswordResetRequest req, CancellationToken ct);
    Task SetManualPasswordAsync(Guid id, AdminSetManualPasswordRequest req, CancellationToken ct);
    Task<AdminUserDto> UnlockAsync(Guid id, CancellationToken ct);
}
