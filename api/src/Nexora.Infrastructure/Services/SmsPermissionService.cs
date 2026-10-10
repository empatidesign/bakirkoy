using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.SmsPermissions;
using Nexora.Application.Features.SmsPermissions.Dtos;
using Nexora.Domain.Entities.Authority;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

// Kullanıcı isteği (2026-10-04): admin panelinde "Roller" bölümüne, SMS gönderme yetkisinin
// kişilere/rollere toplu atanabileceği ve tesis/grup/seans kapsamının toplu
// eşleştirilebileceği bir "Toplu İşlemler" sayfası. Bu servis SmsGovernanceService'in tek
// kapı olarak kontrol ettiği "sms-send.send" iznini rol bazında (RolePermissions, mevcut
// permission akışı korunur) veya KİŞİYE özel (AdminPermissions.Effect=allow/deny, mevcut
// SurveyPlatformService desenine paralel) toplu yönetir; ayrıca mevcut
// AdminScope/ScopeNode modelini (ScopedStaffService.AddScopeAsync ile aynı veri modeli)
// kullanarak tesis/grup/seans kapsamını toplu atar.
public class SmsPermissionService(IUnitOfWork uow, IAuditService audit) : ISmsPermissionService
{
    private const string SmsSendPermissionKey = "sms-send.send";

    public async Task<List<SmsPermissionRoleDto>> GetRolesAsync(CancellationToken ct)
    {
        var roles = await uow.Roles.GetAllAsync(ct);
        var roleIds = roles.Select(r => r.Id).ToList();
        var assignedCounts = await uow.AdminUsers.CountByRolesAsync(roleIds, ct);
        var withSmsSend = await uow.RolePermissions.GetRoleIdsWithPermissionKeyAsync(roleIds, SmsSendPermissionKey, ct);

        return roles
            .OrderBy(r => r.Name)
            .Select(r => new SmsPermissionRoleDto(
                r.Id, r.Key, r.Name, r.Color, r.IsSuperAdmin,
                assignedCounts.GetValueOrDefault(r.Id),
                r.IsSuperAdmin || withSmsSend.Contains(r.Id)))
            .ToList();
    }

    public async Task<List<Guid>> GetUsersWithSmsSendAccessAsync(CancellationToken ct)
    {
        var fromRole = await uow.AdminUsers.GetIdsByPermissionAsync(SmsSendPermissionKey, ct);
        var result = fromRole.ToHashSet();

        var permission = (await uow.Permissions.GetByKeysAsync([SmsSendPermissionKey], ct)).FirstOrDefault();
        if (permission is not null)
        {
            var allUsers = await uow.AdminUsers.FindAsync(u => u.IsActive, ct);
            foreach (var user in allUsers)
            {
                var overrides = await uow.AdminPermissions.GetByAdminUserAsync(user.Id, ct);
                var entry = overrides.FirstOrDefault(o => o.PermissionId == permission.Id);
                if (entry is null) continue;
                if (string.Equals(entry.Effect, "allow", StringComparison.OrdinalIgnoreCase)) result.Add(user.Id);
                else result.Remove(user.Id);
            }
        }

        return result.ToList();
    }

    public async Task<BulkSmsSendAccessResultDto> BulkSetSmsSendAccessAsync(BulkSmsSendAccessRequest req, CancellationToken ct)
    {
        var grant = req.Action switch
        {
            "grant" => true,
            "revoke" => false,
            _ => throw new ConflictException("Geçersiz işlem. 'grant' veya 'revoke' olmalıdır.", "INVALID_ACTION"),
        };

        var permission = (await uow.Permissions.GetByKeysAsync([SmsSendPermissionKey], ct)).FirstOrDefault()
            ?? throw new ConflictException("SMS gönderme izni tanımlı değil.", "PERMISSION_NOT_FOUND");

        var roleIds = (req.RoleIds ?? []).Distinct().ToList();
        var userIds = (req.UserIds ?? []).Distinct().ToList();
        if (roleIds.Count == 0 && userIds.Count == 0)
            throw new ConflictException("En az bir kullanıcı veya rol seçmelisiniz.", "NO_TARGET");

        var rolesAffected = 0;
        if (roleIds.Count > 0)
        {
            var roles = await uow.Roles.FindAsync(r => roleIds.Contains(r.Id), ct);
            var grantableRoleIds = roles.Where(r => !r.IsSuperAdmin).Select(r => r.Id).ToList();
            if (grantableRoleIds.Count > 0)
            {
                if (grant) await uow.RolePermissions.AddPermissionToRolesAsync(grantableRoleIds, permission.Id, ct);
                else await uow.RolePermissions.RemovePermissionFromRolesAsync(grantableRoleIds, permission.Id, ct);
                rolesAffected = grantableRoleIds.Count;
            }
        }

        var usersAffected = 0;
        if (userIds.Count > 0)
        {
            var users = await uow.AdminUsers.FindAsync(u => userIds.Contains(u.Id), ct);
            foreach (var user in users)
            {
                var overrides = await uow.AdminPermissions.GetByAdminUserAsync(user.Id, ct);
                var existing = overrides.FirstOrDefault(o => o.PermissionId == permission.Id);
                if (existing is not null)
                {
                    existing.SetEffect(grant ? "allow" : "deny");
                    uow.AdminPermissions.Update(existing);
                }
                else
                {
                    await uow.AdminPermissions.AddAsync(
                        AdminPermission.Create(user.Id, permission.Id, grant ? "allow" : "deny"), ct);
                }
                usersAffected++;
            }
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PermissionChange,
            EntityType = "SmsSendPermission",
            EntityId = permission.Id,
            Module = "Permissions",
            Description = grant
                ? $"SMS gönderme yetkisi toplu olarak verildi: {usersAffected} kullanıcı, {rolesAffected} rol."
                : $"SMS gönderme yetkisi toplu olarak kaldırıldı: {usersAffected} kullanıcı, {rolesAffected} rol.",
        }, ct);

        return new BulkSmsSendAccessResultDto(usersAffected, rolesAffected);
    }

    public async Task<BulkScopeAssignmentResultDto> BulkAssignScopeAsync(BulkScopeAssignmentRequest req, CancellationToken ct)
    {
        if (req.Targets is null || req.Targets.Count == 0)
            throw new ConflictException("En az bir tesis/grup/seans seçmelisiniz.", "NO_TARGET");

        foreach (var t in req.Targets)
        {
            if (t.Kind is not ("facility" or "group" or "session"))
                throw new ConflictException($"Geçersiz kapsam türü: {t.Kind}", "INVALID_SCOPE_KIND");
            if (t.Kind is "facility" or "group" && (string.IsNullOrWhiteSpace(t.ModuleKey) || !FacilityModuleRegistry.IsValid(t.ModuleKey)))
                throw new ConflictException("Tesis/Grup için geçerli bir modül anahtarı gereklidir.", "INVALID_MODULE_KEY");
        }

        var userIds = (req.UserIds ?? []).Distinct().ToHashSet();
        if (req.RoleIds is { Count: > 0 })
        {
            var roleUsers = await uow.AdminUsers.FindAsync(u => req.RoleIds.Contains(u.RoleId), ct);
            foreach (var u in roleUsers) userIds.Add(u.Id);
        }
        if (userIds.Count == 0)
            throw new ConflictException("En az bir kullanıcı veya rol seçmelisiniz.", "NO_TARGET");

        var users = (await uow.AdminUsers.FindAsync(u => userIds.Contains(u.Id), ct))
            .ToDictionary(u => u.Id);

        var assignmentsApplied = 0;
        foreach (var userId in userIds)
        {
            if (!users.TryGetValue(userId, out var user)) continue;

            var existingScopes = await uow.AdminScopes.GetByAdminUserAsync(userId, ct);
            var existingNodeIds = existingScopes.Select(s => s.ScopeNodeId).ToHashSet();

            foreach (var target in req.Targets)
            {
                var (scopeModuleKey, scopeType, name) = await ResolveTargetAsync(target, ct);
                if (name is null) continue; // kayıt bulunamadı, sessizce atla (diğer hedeflere devam et)

                var node = await uow.ScopeNodes.GetByRefAsync(scopeModuleKey, target.RefId, ct);
                if (node is null)
                {
                    node = ScopeNode.Create(scopeType, scopeModuleKey, target.RefId, name);
                    await uow.ScopeNodes.AddAsync(node, ct);
                    await uow.SaveChangesAsync(ct); // Id'yi netleştir ki aşağıdaki existingNodeIds kontrolü tutarlı olsun
                }

                if (existingNodeIds.Contains(node.Id)) continue;

                await uow.AdminScopes.AddAsync(AdminScope.Create(userId, node.Id), ct);
                existingNodeIds.Add(node.Id);
                assignmentsApplied++;
            }
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PermissionChange,
            EntityType = "AdminScope",
            Module = "Admins",
            Description = $"Toplu yetki alanı ataması: {userIds.Count} kullanıcıya {req.Targets.Count} kapsam için {assignmentsApplied} yeni atama yapıldı.",
        }, ct);

        return new BulkScopeAssignmentResultDto(userIds.Count, req.Targets.Count, assignmentsApplied);
    }

    private async Task<(string ScopeModuleKey, string ScopeType, string? Name)> ResolveTargetAsync(ScopeAssignmentTarget target, CancellationToken ct)
    {
        switch (target.Kind)
        {
            case "facility":
            {
                var facility = await uow.Facilities.GetByIdAsync(target.RefId, ct);
                return (target.ModuleKey!, "Facility", facility is not null && facility.Module == target.ModuleKey ? facility.Name : null);
            }
            case "group":
            {
                var group = await uow.FacilityGroups.GetByIdAsync(target.RefId, ct);
                return ("groups", "Group", group is not null && group.Module == target.ModuleKey ? group.Name : null);
            }
            case "session":
            {
                var session = await uow.Sessions.GetByIdAsync(target.RefId, ct);
                return ("sessions", "Session", session?.Code);
            }
            default:
                return ("", "", null);
        }
    }
}
