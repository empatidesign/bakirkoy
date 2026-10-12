using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Authority;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Persistence;
using Nexora.Infrastructure.Security;
using Nexora.Infrastructure.Services.Email;

namespace Nexora.Infrastructure.Services;

public class ScopedStaffService(
    IUnitOfWork uow,
    IConfiguration configuration,
    IAuditService audit,
    INotificationDispatcher dispatcher,
    IActivityLogger log) : IScopedStaffService
{
    public async Task<ScopedStaffDto> AssignAsync(AssignScopedStaffRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(AssignAsync), new { req.Email, req.RoleTemplateKey, req.ScopeModuleKey, req.ScopeRefId });

        var account = await EnsureUserAsync(req.FullName, req.Tckn, req.Phone, req.Email, req.RoleTemplateKey, ct);
        var node = await EnsureScopeNodeAndBindAsync(account.User, req.ScopeModuleKey, req.ScopeRefId, req.ScopeName, req.ScopeType, ct);

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "AdminUser",
            EntityId = account.User.Id,
            Module = "Admins",
            Description = account.Created
                ? $"Personel hesabı oluşturuldu ve yetki alanı atandı: {account.User.Email} → {account.Role.Name} / {req.ScopeName}"
                : $"Mevcut personele yetki alanı atandı: {account.User.Email} → {account.Role.Name} / {req.ScopeName}",
            NewValues = JsonSerializer.Serialize(new
            {
                account.User.Id,
                account.User.Email,
                RoleKey = account.Role.Key,
                RoleName = account.Role.Name,
                ScopeNodeId = node.Id,
                req.ScopeModuleKey,
                req.ScopeRefId,
                req.ScopeName,
            }),
        }, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PermissionChange,
            EntityType = "AdminScope",
            EntityId = node.Id,
            Module = "Admins",
            Description = $"Yetki alanı bağlandı: {account.User.Email} → {req.ScopeName}",
        }, ct);

        await LogDeliveryAsync(account, req.DeliveryChannel, ct);

        return new ScopedStaffDto(account.User.Id, account.User.FullName, account.User.Email, account.Role.Key, account.Role.Name, node.Id, account.TemporaryPassword);
    }

    public async Task<ScopedStaffDto> EnsureAccountAsync(EnsureStaffAccountRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(EnsureAccountAsync), new { req.Email, req.RoleTemplateKey });

        var account = await EnsureUserAsync(req.FullName, req.Tckn, req.Phone, req.Email, req.RoleTemplateKey, ct);
        await uow.SaveChangesAsync(ct);

        if (account.Created)
        {
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Create,
                EntityType = "AdminUser",
                EntityId = account.User.Id,
                Module = "Admins",
                Description = $"Personel hesabı oluşturuldu: {account.User.Email} → {account.Role.Name}",
                NewValues = JsonSerializer.Serialize(new { account.User.Id, account.User.Email, RoleKey = account.Role.Key, RoleName = account.Role.Name }),
            }, ct);
            await LogDeliveryAsync(account, req.DeliveryChannel, ct);
        }

        return new ScopedStaffDto(account.User.Id, account.User.FullName, account.User.Email, account.Role.Key, account.Role.Name, Guid.Empty, account.TemporaryPassword);
    }

    public async Task AddScopeAsync(Guid adminUserId, string scopeModuleKey, Guid scopeRefId, string scopeName, string scopeType, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(adminUserId, ct);
        if (user is null) return;

        var node = await EnsureScopeNodeAndBindAsync(user, scopeModuleKey, scopeRefId, scopeName, scopeType, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PermissionChange,
            EntityType = "AdminScope",
            EntityId = node.Id,
            Module = "Admins",
            Description = $"Yetki alanı bağlandı: {user.Email} → {scopeName}",
        }, ct);
    }

    private async Task<StaffAccount> EnsureUserAsync(string fullName, string? tckn, string? phone, string email, string roleTemplateKey, CancellationToken ct)
    {
        var template = RoleTemplateRegistry.FindByTemplateKey(roleTemplateKey)
            ?? throw new ConflictException("Geçersiz rol şablonu.", "INVALID_ROLE_TEMPLATE");

        var role = await uow.Roles.GetByKeyAsync(template.RoleKey, ct)
            ?? throw new ConflictException("Rol şablonu henüz hazır değil. Lütfen daha sonra tekrar deneyin.", "ROLE_TEMPLATE_NOT_SEEDED");

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var existing = await uow.AdminUsers.GetByEmailAsync(normalizedEmail, ct);
        if (existing is not null)
            return new StaffAccount(existing, role, null, false);

        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var temporaryPassword = PasswordGenerator.Generate(length, useMock);
        var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(temporaryPassword);

        var user = AdminUser.Create(fullName.Trim(), normalizedEmail, phone, null, hash, role.Id);
        await uow.AdminUsers.AddAsync(user, ct);
        return new StaffAccount(user, role, temporaryPassword, true);
    }

    private async Task<ScopeNode> EnsureScopeNodeAndBindAsync(AdminUser user, string scopeModuleKey, Guid scopeRefId, string scopeName, string scopeType, CancellationToken ct)
    {
        var node = await uow.ScopeNodes.GetByRefAsync(scopeModuleKey, scopeRefId, ct);
        if (node is null)
        {
            node = ScopeNode.Create(scopeType, scopeModuleKey, scopeRefId, scopeName);
            await uow.ScopeNodes.AddAsync(node, ct);
        }

        var scopes = await uow.AdminScopes.GetByAdminUserAsync(user.Id, ct);
        if (!scopes.Any(s => s.ScopeNodeId == node.Id))
        {
            var scope = AdminScope.Create(user.Id, node.Id);
            await uow.AdminScopes.AddAsync(scope, ct);
        }

        return node;
    }

    private async Task LogDeliveryAsync(StaffAccount account, string deliveryChannel, CancellationToken ct)
    {
        var channel = deliveryChannel == "Sms" ? "SMS" : "E-posta";
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        log.LogStep("DeliverCredentials", new
        {
            account.User.Email,
            account.User.Phone,
            Channel = channel,
            TemporaryPassword = account.TemporaryPassword is null ? null : "***",
            Note = account.TemporaryPassword is null
                ? "Mevcut hesap; yeni şifre üretilmedi."
                : "İlk girişte şifre değişikliği zorunlu.",
        });

        if (deliveryChannel == "Sms" && account.TemporaryPassword is not null && !string.IsNullOrWhiteSpace(account.User.Phone))
            await dispatcher.SendSmsAsync(account.User.Phone!,
                $"Bakırköy Belediyesi yönetim paneli hesabınız oluşturuldu. Geçici şifreniz: {account.TemporaryPassword}. İlk girişte değiştirmeniz gerekir.", ct);
        else if (deliveryChannel != "Sms" && account.TemporaryPassword is not null && !string.IsNullOrWhiteSpace(account.User.Email))
        {
            var email = EmailTemplates.ParticipantCredentials(account.User.FullName, account.User.Email, account.TemporaryPassword, "");
            await dispatcher.SendEmailAsync(account.User.Email, email.Subject, email.HtmlBody, ct);
        }
    }

    private record StaffAccount(AdminUser User, Role Role, string? TemporaryPassword, bool Created);
}
