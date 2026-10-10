using Nexora.Domain.Entities.Authority;

namespace Nexora.Application.Common.Repositories;

public interface IScopeNodeRepository : IRepository<ScopeNode>
{
    Task<ScopeNode?> GetByRefAsync(string refModuleKey, Guid refId, CancellationToken ct);
    Task<List<ScopeNode>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
}

public interface IScopeEdgeRepository : IRepository<ScopeEdge>
{
    Task<List<ScopeEdge>> GetByParentAsync(Guid parentNodeId, CancellationToken ct);
}

public interface IAdminScopeRepository : IRepository<AdminScope>
{
    Task<List<AdminScope>> GetByAdminUserAsync(Guid adminUserId, CancellationToken ct);
    Task<List<AdminScope>> GetByScopeNodeAsync(Guid scopeNodeId, CancellationToken ct);
    // Kullanıcı isteği (2026-08-03): yönetici LİSTE ekranında (ör. Header'daki "Alt Kullanıcılar"
    // göstergesi) her satır için ayrı ayrı GetByAdminUserAsync çağırmak yerine — birden fazla
    // yönetici için tek sorguda tüm scope kayıtlarını toplu getirir (N+1 önlemi).
    Task<List<AdminScope>> GetByAdminUsersAsync(IReadOnlyCollection<Guid> adminUserIds, CancellationToken ct);
    // Kullanıcı isteği: yönetici tesis-yetki listesini güncellerken kaldırılan kayıtlar
    // GERÇEKTEN silinmeli (soft-delete değil) — (AdminUserId, ScopeNodeId) üzerindeki unique
    // index'in partial (WHERE NOT IsDeleted) filtresi olmadığı için, soft-delete'li bir satır
    // aynı tesis tekrar eklenmek istendiğinde constraint çakışmasına yol açar.
    void HardRemoveRange(IEnumerable<AdminScope> entities);
}

public interface IAdminPermissionRepository : IRepository<AdminPermission>
{
    Task<List<AdminPermission>> GetByAdminUserAsync(Guid adminUserId, CancellationToken ct);
}
