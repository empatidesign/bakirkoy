using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Authority;

public class AdminPermission : BaseEntity
{
    public Guid AdminUserId { get; private set; }
    public Guid PermissionId { get; private set; }
    public string Effect { get; private set; } = string.Empty;

    public static AdminPermission Create(Guid adminUserId, Guid permissionId, string effect)
        => new()
        {
            AdminUserId = adminUserId,
            PermissionId = permissionId,
            Effect = effect.Trim(),
        };

    // Kullanıcı isteği (2026-10-04, Toplu İşlemler): (AdminUserId, PermissionId) üzerinde
    // partial olmayan unique index var (bkz. AdminScope'taki aynı desendeki not) — bir
    // override kaydını soft-delete edip yeniden eklemek constraint çakışmasına yol açar.
    // Bu yüzden mevcut kayıt varsa SİLİNMEZ, Effect yerinde güncellenir.
    public void SetEffect(string effect)
    {
        Effect = effect.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
