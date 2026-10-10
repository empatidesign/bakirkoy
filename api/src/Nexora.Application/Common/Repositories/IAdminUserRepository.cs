using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Application.Common.Repositories;

public interface IAdminUserRepository : IRepository<AdminUser>
{
    Task<AdminUser?> GetByEmailAsync(string email, CancellationToken ct);

    /// <summary>
    /// Telefon numarasıyla kullanıcı arar. Veritabanındaki numaralar tek bir formatta
    /// değil ("5321002006", "05321002006", "+905321002006" hepsi mevcut), bu yüzden
    /// eşleşme rakamların son 10 hanesi üzerinden yapılır.
    /// </summary>
    Task<AdminUser?> GetByPhoneAsync(string phone, CancellationToken ct);
    Task<bool> ExistsByEmailAsync(string email, CancellationToken ct);
    Task<bool> ExistsByPhoneAsync(string phone, CancellationToken ct);
    Task<int> CountByRoleAsync(Guid roleId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountByRolesAsync(IReadOnlyList<Guid> roleIds, CancellationToken ct);
    Task<int> CountByDepartmentAsync(string departmentName, CancellationToken ct);
    Task<Dictionary<string, int>> CountByDepartmentsAsync(IReadOnlyList<string> departmentNames, CancellationToken ct);
    Task<int> RenameDepartmentAsync(string oldName, string newName, CancellationToken ct);
    Task<PagedResult<AdminUser>> GetPagedAsync(AdminListParams p, CancellationToken ct);
    Task<List<Guid>> GetIdsByPermissionAsync(string permissionKey, CancellationToken ct);
}
