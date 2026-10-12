using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using Nexora.Application.Features.Auth;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Entities.Authority;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;
using Nexora.Infrastructure.Services.Email;

namespace Nexora.Infrastructure.Services;

public class AdminUserManagementService(
    IUnitOfWork uow,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    IAuditService audit,
    IConfiguration configuration,
    IAuthService authService,
    INotificationDispatcher dispatcher,
    IOtpService otpService,
    IActivityLogger log) : IAdminUserManagementService
{
    // Kullanıcı isteği: rol adı/anahtarı içinde geçen facility-template modül anahtarını
    // tespit ediyoruz (ör. "demo-module-sports" -> "sports"). Bu tespit sadece "hangi tesis
    // listesi gösterilecek" kararını yönlendirir; gerçek erişim kısıtı AdminScope/ScopeNode +
    // UserScopeService üzerinden zaten backend'in her yerinde uygulanıyor.
    private static string? DetectFacilityModule(Role? role) => FacilityModuleRegistry.DetectFromRoleKey(role?.Key);

    public async Task<PagedResult<AdminUserDto>> GetPagedAsync(AdminListParams p, CancellationToken ct)
    {
        await EnsureCallerIsUnscopedAsync(ct);

        var effective = p;
        if (!string.IsNullOrWhiteSpace(p.Role))
        {
            var filterRole = await uow.Roles.GetByKeyAsync(p.Role, ct);
            if (filterRole is not null)
                effective = p with { Role = null, RoleId = filterRole.Id };
        }

        var paged = await uow.AdminUsers.GetPagedAsync(effective, ct);
        var byId = (await uow.Roles.GetAllAsync(ct)).ToDictionary(r => r.Id);

        // Kullanıcı isteği (2026-08-03): liste ekranında da (ör. Header'daki "Alt Kullanıcılar"
        // göstergesi, GET /admins?facilityModule=...) her satırın facilityScopeModule/
        // facilityScopeIds alanları dolu gelmeli — önceden burada ToDto() varsayılan (null)
        // parametrelerle çağrılıyordu, bu da liste üzerinden facility-scope bilgisine hiç
        // erişilememesine yol açıyordu (frontend filtresi her zaman boş dönerdi). Tüm sayfa
        // için scope verisi TEK sorguda toplu çekilir (N+1 önlenir).
        var userIds = paged.Items.Select(u => u.Id).ToList();
        var allScopes = await uow.AdminScopes.GetByAdminUsersAsync(userIds, ct);
        var nodeIds = allScopes.Select(s => s.ScopeNodeId).Distinct().ToList();
        var nodesById = (await uow.ScopeNodes.GetByIdsAsync(nodeIds, ct)).ToDictionary(n => n.Id);
        var scopesByUser = allScopes
            .Where(s => nodesById.ContainsKey(s.ScopeNodeId))
            .GroupBy(s => s.AdminUserId)
            .ToDictionary(g => g.Key, g => g.Select(s => nodesById[s.ScopeNodeId]).Where(n => n.IsActive).ToList());

        return new PagedResult<AdminUserDto>
        {
            Items = paged.Items.Select(u =>
            {
                var role = byId.TryGetValue(u.RoleId, out var r) ? r : null;
                var facilityModule = DetectFacilityModule(role);
                List<Guid>? scopeIds = null;
                if (facilityModule is not null && scopesByUser.TryGetValue(u.Id, out var nodes))
                    scopeIds = nodes.Where(n => n.RefModuleKey == facilityModule).Select(n => n.RefId).Distinct().ToList();
                return ToDto(u, role, facilityModule, scopeIds);
            }).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<AdminUserDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");
        return await ToDtoAsync(user, ct);
    }

    public async Task<AdminUserDto> CreateAsync(CreateAdminRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Email });

        await EnsureCallerIsUnscopedAsync(ct);

        var role = await ResolveRoleAsync(req.Role, ct);

        if (await IsSuperAdminRoleAsync(role, ct) && !currentUser.IsSuperAdmin)
            throw new ForbiddenException("Süper Yönetici hesabı oluşturmak için yetkiniz yok.");

        if (await uow.AdminUsers.ExistsByEmailAsync(req.Email, ct))
            throw new ConflictException("Bu e-posta adresi zaten kullanılıyor.", "DUPLICATE_EMAIL");

        if (!string.IsNullOrWhiteSpace(req.Phone) && await uow.AdminUsers.ExistsByPhoneAsync(req.Phone, ct))
            throw new ConflictException("Bu telefon numarası zaten kullanılıyor.", "DUPLICATE_PHONE");

        var isSms = string.Equals(req.DeliveryChannel, "Sms", StringComparison.OrdinalIgnoreCase);
        var hasManualPassword = !string.IsNullOrWhiteSpace(req.ManualPassword);
        if (!hasManualPassword && isSms && string.IsNullOrWhiteSpace(req.Phone))
            throw new ConflictException("Geçici şifre SMS ile gönderilecek ancak telefon numarası girilmemiş. Lütfen telefon numarası girin.", "PHONE_REQUIRED_FOR_SMS");

        // Kullanıcı talimatı (2026-08-04): "şifreyi manuel oluşturulabilir" — ManualPassword
        // doluysa rastgele şifre üretilmiyor, doğrudan bu şifre kullanılıyor ve
        // SMS/e-posta gönderimi hiç yapılmıyor (kişi şifreyi zaten biliyor).
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var generatedPassword = hasManualPassword ? req.ManualPassword! : PasswordGenerator.Generate(length, useMock);
        var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

        var user = AdminUser.Create(req.FullName, req.Email, req.Phone, req.Department, hash, role.Id);
        user.ConfigureSurveyAccess(
            req.IsSurveyUser, req.SurveyAllNeighborhoods, req.SurveyOwnSurveysOnly,
            req.SurveyCanViewParticipants, req.SurveyCanViewPastSurveys, req.SurveyCreateOnly,
            req.SurveyNeighborhoods);

        await uow.AdminUsers.AddAsync(user, ct);
        await uow.SaveChangesAsync(ct);

        var facilityModule = DetectFacilityModule(role);
        if (facilityModule is not null && req.FacilityScopeIds is { Count: > 0 })
            await SyncFacilityScopeAsync(user, facilityModule, req.FacilityScopeIds, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = $"Yönetici oluşturuldu: {user.Email}" + (hasManualPassword ? " (manuel şifre)" : ""),
            NewValues = JsonSerializer.Serialize(await ToDtoAsync(user, ct)),
        }, ct);

        if (!hasManualPassword && isSms)
            await dispatcher.SendSmsAsync(user.Phone!,
                $"Sayın {user.FullName}, Bakırköy Belediyesi yönetim paneli giriş şifreniz: {generatedPassword}. İlk girişte değiştirmeniz zorunludur.", ct);
        else if (!hasManualPassword && !isSms && !string.IsNullOrWhiteSpace(user.Email))
        {
            var email = EmailTemplates.AdminCredentials(user.FullName, user.Email, generatedPassword, "");
            await dispatcher.SendEmailAsync(user.Email, email.Subject, email.HtmlBody, ct);
        }

        log.LogStepResult(nameof(CreateAsync), new { user.Id, DeliveryChannel = hasManualPassword ? "Manual" : (isSms ? "SMS" : "E-posta") });

        return await ToDtoAsync(user, ct);
    }

    public async Task<AdminUserDto> UpdateAsync(Guid id, UpdateAdminRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");

        var beforeRole = await uow.Roles.GetByIdAsync(user.RoleId, ct);

        if (await IsSuperAdminRoleAsync(beforeRole, ct) && !currentUser.IsSuperAdmin)
            throw new ForbiddenException("Süper Yönetici hesabını düzenlemek için yetkiniz yok.");

        var role = await ResolveRoleAsync(req.Role, ct);

        if (await IsSuperAdminRoleAsync(role, ct) && !currentUser.IsSuperAdmin)
            throw new ForbiddenException("Süper Yönetici rolü atamak için yetkiniz yok.");

        var before = await ToDtoAsync(user, ct);

        var phoneChanged = !string.Equals(user.Phone, req.Phone, StringComparison.Ordinal);
        // DÜZELTME (2026-08-26, KAPSAMLI SİSTEM TESTİ, madde X-AUT-05 — P0): rol değişikliği
        // önceden hiçbir oturum sonlandırma tetiklemiyordu. Canlı testte kanıtlandı: bir
        // SuperAdmin'in yetkisi DB'de düşürülse bile, elindeki eski access token kendi
        // doğal süresi (60 dk) boyunca TAM eski yetkiyle çalışmaya devam ediyordu — hatta
        // bu tokenla yeni bir SuperAdmin hesabı bile oluşturulabiliyordu (JWT claim'e
        // güvenen middleware/CurrentUser DB'ye hiç bakmıyor). Artık phone/email değişikliğiyle
        // aynı şekilde rol değişikliğinde de tüm aktif oturumlar sonlandırılıyor.
        var roleChanged = beforeRole is not null && beforeRole.Id != role.Id;

        var emailChanged = false;
        if (!string.IsNullOrWhiteSpace(req.Email) && !string.Equals(req.Email.Trim(), user.Email, StringComparison.OrdinalIgnoreCase))
        {
            var newEmail = req.Email.Trim();
            if (await uow.AdminUsers.ExistsByEmailAsync(newEmail, ct))
                throw new ConflictException("Bu e-posta adresi başka bir yönetici tarafından kullanılıyor.", "DUPLICATE_EMAIL");
            user.SetEmail(newEmail);
            emailChanged = true;
        }

        user.Update(req.FullName, req.Phone, req.Department, role.Id);
        user.ConfigureSurveyAccess(
            req.IsSurveyUser, req.SurveyAllNeighborhoods, req.SurveyOwnSurveysOnly,
            req.SurveyCanViewParticipants, req.SurveyCanViewPastSurveys, req.SurveyCreateOnly,
            req.SurveyNeighborhoods);

        uow.AdminUsers.Update(user);
        await uow.SaveChangesAsync(ct);

        // Kullanıcı isteği: "Spor Salonu Yöneticisi" gibi bir facility-template rolü
        // seçildiğinde, admin panelden çok-seçimli işaretlenen tesis listesi burada
        // AdminScope/ScopeNode kayıtlarıyla senkronize ediliyor — FacilityScopeIds=null
        // gönderilirse (frontend rolün facility modülüyle ilgisiz olduğunu biliyorsa)
        // mevcut yetki alanına DOKUNULMAZ; boş liste [] ise yönetici o modülde hiçbir
        // tesis göremeyecek şekilde tüm ilgili yetki alanları kaldırılır.
        var facilityModule = DetectFacilityModule(role);
        if (facilityModule is not null && req.FacilityScopeIds is not null)
        {
            await SyncFacilityScopeAsync(user, facilityModule, req.FacilityScopeIds, ct);
            if (facilityModule == "library")
            {
                var staff = await uow.LibraryStaff.GetByAdminUserAsync(user.Id, ct);
                if (staff is not null)
                {
                    staff.Sync(user.FullName, user.Email, user.Phone, role.Name,
                        req.FacilityScopeIds, staff.CanEditOwnShifts, false);
                    uow.LibraryStaff.Update(staff);
                    await uow.SaveChangesAsync(ct);
                }
            }
        }

        if (phoneChanged || emailChanged || roleChanged)
            await authService.TerminateSessionsAsync(user.Id, ct);

        var after = await ToDtoAsync(user, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = $"Yönetici güncellendi: {user.Email}",
            OldValues = JsonSerializer.Serialize(before),
            NewValues = JsonSerializer.Serialize(after),
        }, ct);

        return after;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(DeleteAsync), new { id });

        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");

        var userRole = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        if (await IsSuperAdminRoleAsync(userRole, ct))
            throw new ConflictException("Süper Yönetici hesabı silinemez.", "SUPER_ADMIN_DELETE_FORBIDDEN");

        if (user.Id == currentUser.Id)
            throw new ConflictException("Kendi hesabınızı silemezsiniz.", "SELF_DELETE_FORBIDDEN");

        var snapshot = await ToDtoAsync(user, ct);

        // NOT (2026-09-05, gerçek testte bulunan cascade-delete bug'ı): bir yönetici silinince
        // ilişkili AdminScope kayıtları hiç temizlenmiyordu. Bu, aynı email'le (örn. muhtar
        // hesabı, mahalle adına dayalı otomatik üretilen) yeniden bir hesap oluşturulduğunda,
        // ESKİ (artık silinmiş kullanıcıya ait) AdminScope kaydının hâlâ aktif kalması ve
        // GetByScopeNodeAsync sorgusunun `scopes[0]` ile YANLIŞ (silinmiş) kullanıcıyı
        // döndürmesi sonucunu doğuruyordu (bkz. Muhtarlık modülü — provisionMuhtar sonrası
        // accountProvisioned hâlâ false görünüyordu). HardRemoveRange kullanılıyor (soft-delete
        // değil) çünkü (AdminUserId, ScopeNodeId) unique index'i partial/filtreli değil —
        // soft-delete bırakmak aynı sınıfta bir constraint çakışması riski taşır (bkz.
        // IAdminScopeRepository.HardRemoveRange dokümantasyonu, tam olarak bu senaryo için var).
        var scopes = await uow.AdminScopes.GetByAdminUserAsync(user.Id, ct);
        if (scopes.Count > 0)
            uow.AdminScopes.HardRemoveRange(scopes);

        uow.AdminUsers.Delete(user);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = $"Yönetici silindi: {user.Email}",
            OldValues = JsonSerializer.Serialize(snapshot),
        }, ct);
    }

    public async Task<AdminUserDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");

        var userRole = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        if (await IsSuperAdminRoleAsync(userRole, ct))
            throw new ConflictException("Süper Yönetici hesabı pasif yapılamaz.", "SUPER_ADMIN_STATUS_FORBIDDEN");

        if (user.Id == currentUser.Id)
            throw new ConflictException("Kendi hesabınızın durumunu değiştiremezsiniz.", "SELF_STATUS_FORBIDDEN");

        if (user.IsActive) user.Deactivate();
        else user.Activate();

        uow.AdminUsers.Update(user);
        await uow.SaveChangesAsync(ct);

        // Kullanıcı pasifleştirildiğinde mevcut token'ının kalan ömrü boyunca çalışmaya
        // devam etmemesi için tüm oturumları anında sonlandır (refresh token + oturum seti silinir,
        // OnTokenValidated'daki concurrent-session kontrolü sayesinde eski access token de reddedilir).
        if (!user.IsActive)
            await authService.TerminateSessionsAsync(user.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = user.IsActive
                ? $"Yönetici aktifleştirildi: {user.Email}"
                : $"Yönetici pasifleştirildi: {user.Email}",
        }, ct);

        return await ToDtoAsync(user, ct);
    }

    public async Task<AdminUserDto> UnlockAsync(Guid id, CancellationToken ct)
    {
        log.LogStep(nameof(UnlockAsync), new { id });

        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");

        if (!user.IsLocked && user.FailedLoginCount == 0)
            return await ToDtoAsync(user, ct);

        user.Unlock();
        uow.AdminUsers.Update(user);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = $"Hesap kilidi kaldırıldı: {user.Email}",
        }, ct);

        return await ToDtoAsync(user, ct);
    }

    public async Task SendPasswordResetAsync(Guid id, SendPasswordResetRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(SendPasswordResetAsync), new { id, req.Channel });

        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");

        var isSms = req.Channel == "Sms";
        if (isSms && string.IsNullOrWhiteSpace(user.Phone))
            throw new ConflictException("Bu yöneticinin telefon numarası tanımlı değil.", "PHONE_NOT_SET");

        var target = isSms ? user.Phone! : user.Email;

        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var generatedPassword = PasswordGenerator.Generate(length, useMock);
        var newHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

        if (isSms)
        {
            var delivered = await dispatcher.SendSmsAsync(target,
                $"Sayın {user.FullName}, Bakırköy Belediyesi yönetim paneli yeni giriş şifreniz: {generatedPassword}. İlk girişte değiştirmeniz zorunludur.", ct);
            if (!delivered)
                throw new ConflictException("Geçici şifre SMS ile gönderilemedi. Mevcut şifre korundu; lütfen daha sonra tekrar deneyin.", "CREDENTIAL_DELIVERY_FAILED");
        }
        else if (!string.IsNullOrWhiteSpace(user.Email))
        {
            var email = EmailTemplates.AdminCredentials(user.FullName, user.Email, generatedPassword, "");
            await dispatcher.SendEmailAsync(user.Email, email.Subject, email.HtmlBody, ct);
        }

        user.ResetTemporaryPassword(newHash);
        uow.AdminUsers.Update(user);
        await uow.SaveChangesAsync(ct);

        await authService.TerminateSessionsAsync(user.Id, ct);
        await otpService.InvalidateAsync(user.Id, Nexora.Domain.Enums.OtpPurpose.PasswordReset, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = $"Geçici şifre gönderildi, ilk girişte değişim zorunlu ({(isSms ? "SMS" : "E-posta")}): {user.Email}",
        }, ct);

        log.LogStepResult(nameof(SendPasswordResetAsync), new
        {
            user.Email,
            Channel = isSms ? "SMS" : "E-posta",
        });
    }

    public async Task SetManualPasswordAsync(Guid id, AdminSetManualPasswordRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(SetManualPasswordAsync), new { id, req.MustChangeOnFirstLogin });

        await EnsureCallerIsUnscopedAsync(ct);

        var user = await uow.AdminUsers.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Yönetici bulunamadı.", "ADMIN_NOT_FOUND");

        var userRole = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        if (await IsSuperAdminRoleAsync(userRole, ct) && !currentUser.IsSuperAdmin)
            throw new ForbiddenException("Süper Yönetici hesabının şifresini değiştirmek için yetkiniz yok.");

        var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(req.NewPassword);
        if (req.MustChangeOnFirstLogin)
            user.ResetTemporaryPassword(hash);
        else
            user.CompletePasswordChange(hash);

        uow.AdminUsers.Update(user);
        await uow.SaveChangesAsync(ct);

        await authService.TerminateSessionsAsync(user.Id, ct);
        await otpService.InvalidateAsync(user.Id, Nexora.Domain.Enums.OtpPurpose.PasswordReset, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Admins",
            Description = req.MustChangeOnFirstLogin
                ? $"Şifre yönetici tarafından elle belirlendi; ilk girişte değişim zorunlu: {user.Email}"
                : $"Şifre yönetici tarafından elle belirlendi: {user.Email}",
        }, ct);
    }

    /// <summary>
    /// "admins" izin modülü katalogda scopable=true işaretli ama gerçekte hiçbir yerde
    /// admin-hesaplarına özel bir ScopeNode/AdminScope ataması yapılmıyor. Bu nedenle
    /// sistemde scope kısıtlaması OLAN (tek bir tesis/kütüphane/gezi vb. ile sınırlı)
    /// bir personelin "admins.edit" gibi bir izne sahip olması durumunda scope dışı
    /// kalıp TÜM yöneticileri (SuperAdmin hariç) görüp düzenleyebilmesi önlenir.
    /// Scope kısıtlaması olmayan (tam yetkili) kullanıcılar normal şekilde erişebilir.
    /// </summary>
    private async Task EnsureCallerIsUnscopedAsync(CancellationToken ct)
    {
        if (currentUser.IsSuperAdmin) return;
        if (currentUser.Id is not Guid callerId) return;

        var groups = await userScope.GetScopeGroupsAsync(callerId, ct);
        if (groups.Count > 0)
            throw new ForbiddenException(
                "Belirli bir kapsama (tesis/kütüphane/gezi vb.) atanmış personel, yönetici hesaplarını görüntüleyemez veya düzenleyemez.",
                "ADMINS_MODULE_SCOPE_RESTRICTED");
    }

    private async Task<Role> ResolveRoleAsync(string roleKey, CancellationToken ct)
    {
        var role = await uow.Roles.GetByKeyAsync(roleKey, ct)
            ?? throw new ConflictException("Geçersiz rol.", "INVALID_ROLE");

        if (!role.IsActive)
            throw new ConflictException("Bu rol pasif durumda, atanamaz.", "ROLE_INACTIVE");

        return role;
    }

    private static Task<bool> IsSuperAdminRoleAsync(Role? role, CancellationToken ct)
        => Task.FromResult(role?.IsSuperAdmin == true);

    private async Task<AdminUserDto> ToDtoAsync(AdminUser user, CancellationToken ct)
    {
        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        var facilityModule = DetectFacilityModule(role);
        List<Guid>? scopeIds = null;
        if (facilityModule is not null)
            scopeIds = await GetFacilityScopeIdsAsync(user.Id, facilityModule, ct);

        return ToDto(user, role, facilityModule, scopeIds);
    }

    // Kullanıcı isteği: yöneticinin şu anda hangi tesislere atanmış olduğunu bulur —
    // düzenleme ekranı açıldığında mevcut seçimlerin önceden işaretli gelmesi için kullanılır.
    private async Task<List<Guid>> GetFacilityScopeIdsAsync(Guid adminUserId, string facilityModule, CancellationToken ct)
    {
        var scopes = await uow.AdminScopes.GetByAdminUserAsync(adminUserId, ct);
        if (scopes.Count == 0) return [];

        var nodeIds = scopes.Select(s => s.ScopeNodeId).Distinct().ToList();
        var nodes = await uow.ScopeNodes.GetByIdsAsync(nodeIds, ct);
        return nodes
            .Where(n => n.IsActive && n.RefModuleKey == facilityModule)
            .Select(n => n.RefId)
            .Distinct()
            .ToList();
    }

    // Kullanıcı isteği: admin panelden çok-seçimli işaretlenen tesis kimliklerini,
    // yöneticinin AdminScope/ScopeNode kayıtlarıyla senkronize eder. Sadece belirtilen
    // facilityModule'e ait mevcut yetki alanları hesaba katılır/değiştirilir — başka bir
    // modüle (ör. bir kütüphane sorumluluğu) ait yetki alanları hiç etkilenmez.
    // AdminScopes tablosunda (AdminUserId, ScopeNodeId) üzerinde partial olmayan bir unique
    // index olduğu için kaldırılan kayıtlar soft-delete değil GERÇEKTEN silinir (HardRemove),
    // aksi halde aynı tesis daha sonra tekrar eklenmek istendiğinde unique constraint çakışması
    // (Ignore edilen soft-delete satırı yüzünden) oluşurdu.
    private async Task SyncFacilityScopeAsync(AdminUser user, string facilityModule, List<Guid> desiredFacilityIds, CancellationToken ct)
    {
        var facilities = await uow.Facilities.FindAsync(
            f => f.Module == facilityModule && desiredFacilityIds.Contains(f.Id), ct);
        var validIds = facilities.Select(f => f.Id).ToHashSet();
        var namesById = facilities.ToDictionary(f => f.Id, f => f.Name);

        var existingScopes = await uow.AdminScopes.GetByAdminUserAsync(user.Id, ct);
        var existingNodeIds = existingScopes.Select(s => s.ScopeNodeId).Distinct().ToList();
        var existingNodes = existingNodeIds.Count > 0
            ? await uow.ScopeNodes.GetByIdsAsync(existingNodeIds, ct)
            : [];
        var nodeById = existingNodes.ToDictionary(n => n.Id);

        // Artık istenmeyenleri (mevcut ama desiredFacilityIds içinde olmayan) kaldır.
        var toRemove = existingScopes
            .Where(s => nodeById.TryGetValue(s.ScopeNodeId, out var n)
                && n.RefModuleKey == facilityModule
                && !validIds.Contains(n.RefId))
            .ToList();
        if (toRemove.Count > 0)
            uow.AdminScopes.HardRemoveRange(toRemove);

        // Eksik olanları ekle.
        var currentFacilityIds = existingScopes
            .Where(s => nodeById.TryGetValue(s.ScopeNodeId, out var n) && n.RefModuleKey == facilityModule)
            .Select(s => nodeById[s.ScopeNodeId].RefId)
            .ToHashSet();
        var toAdd = validIds.Where(id => !currentFacilityIds.Contains(id)).ToList();

        foreach (var facilityId in toAdd)
        {
            var node = await uow.ScopeNodes.GetByRefAsync(facilityModule, facilityId, ct);
            if (node is null)
            {
                node = ScopeNode.Create("Facility", facilityModule, facilityId, namesById.GetValueOrDefault(facilityId, ""));
                await uow.ScopeNodes.AddAsync(node, ct);
                await uow.SaveChangesAsync(ct); // Id'yi almak için — aşağıda AdminScope buna referans verecek.
            }
            var scope = AdminScope.Create(user.Id, node.Id);
            await uow.AdminScopes.AddAsync(scope, ct);
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PermissionChange,
            EntityType = "AdminScope",
            EntityId = user.Id,
            Module = "Admins",
            Description = $"Tesis yetki alanı güncellendi: {user.Email} → {facilityModule} modülünde {validIds.Count} tesis ({toAdd.Count} eklendi, {toRemove.Count} kaldırıldı)",
        }, ct);
    }

    private static AdminUserDto ToDto(AdminUser user, Role? role, string? facilityScopeModule = null, List<Guid>? facilityScopeIds = null)
        => new(user.Id, user.FullName, user.Email, user.Phone, user.Department,
            user.RoleId, role?.Key, role?.Name ?? "", role?.Color,
            user.IsActive, user.IsFirstLogin, user.LastLoginAt, user.CreatedAt,
            user.IsLocked, user.LockedUntil, user.FailedLoginCount,
            facilityScopeModule, facilityScopeIds,
            user.IsSurveyUser, user.SurveyAllNeighborhoods, user.SurveyOwnSurveysOnly,
            user.SurveyCanViewParticipants, user.SurveyCanViewPastSurveys, user.SurveyCreateOnly,
            user.SurveyNeighborhoods);
}
