using Nexora.Domain.Entities.Auth;

namespace Nexora.Application.Common.Repositories;

public interface IPermissionModuleRepository : IRepository<PermissionModule>
{
    Task<List<PermissionModule>> GetAllOrderedAsync(CancellationToken ct);
}

public interface IPermissionRepository : IRepository<Permission>
{
    Task<List<Permission>> GetActiveAsync(CancellationToken ct);
    Task<List<Permission>> GetByKeysAsync(IEnumerable<string> keys, CancellationToken ct);
    Task<List<Permission>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct);
}

public interface IRolePermissionRepository : IRepository<RolePermission>
{
    Task<List<Guid>> GetPermissionIdsByRoleAsync(Guid roleId, CancellationToken ct);
    Task<int> CountByRoleAsync(Guid roleId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountByRolesAsync(IEnumerable<Guid> roleIds, CancellationToken ct);
    Task ReplaceForRoleAsync(Guid roleId, IReadOnlyCollection<Guid> permissionIds, CancellationToken ct);
    // Kullanıcı isteği (2026-08-05): Yöneticiler formunda "kütüphane görevlisi" yetkisine
    // (library-mesai.door-access) sahip roller seçildiğinde kapı erişimi + kütüphane
    // checklist'i göstermek için — RoleOptionDto.HasLibraryDoorPermission alanını doldurur.
    // Toplu (N+1 önler): tek sorguda hangi rollerin bu permission key'e sahip olduğunu döner.
    Task<HashSet<Guid>> GetRoleIdsWithPermissionKeyAsync(IEnumerable<Guid> roleIds, string permissionKey, CancellationToken ct);
    // Kullanıcı isteği (2026-10-04): Roller > Toplu İşlemler sayfasından birden fazla role
    // TEK bir izni (ör. sms-send.send) eklemek/kaldırmak için — ReplaceForRoleAsync tüm izin
    // listesini değiştirdiği için bu amaç için uygun değil (rolün diğer izinlerini korumalı).
    Task AddPermissionToRolesAsync(IReadOnlyCollection<Guid> roleIds, Guid permissionId, CancellationToken ct);
    Task RemovePermissionFromRolesAsync(IReadOnlyCollection<Guid> roleIds, Guid permissionId, CancellationToken ct);
}
