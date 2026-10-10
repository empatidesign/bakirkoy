using Nexora.Application.Features.Facilities;
using Mapster;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Common.Security;
using Nexora.Application.Features.Auth;
using Nexora.Application.Features.Auth.Dtos;
using Nexora.Domain.Entities.Auth;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;
using Nexora.Infrastructure.Services.Email;

namespace Nexora.Infrastructure.Services;

public class AuthService(
    IUnitOfWork uow,
    IJwtService jwtService,
    IOtpService otpService,
    IRedisService redis,
    IConfiguration config,
    IAuditService audit,
    ICurrentUser currentUser,
    IUserScopeService userScope,
    INotificationDispatcher dispatcher,
    IActivityLogger log) : IAuthService
{
    private TimeSpan RefreshTokenTtl
        => TimeSpan.FromDays(config.GetValue("TokenSettings:Admin:RefreshTokenDays", 7));

    private int AccessTokenMinutes
        => config.GetValue("JwtSettings:AccessTokenMinutes", 60);

    // Kullanıcı isteği (2026-09-21): "5 deneme yanlış girilirse 5 dakika kısıtla,
    // ama bu süreyi botlar tahmin edemesin, 4-5 dakika içinde farklı saniye
    // açılsın". Taban 4 dakika + her denemede kriptografik olarak yeniden
    // üretilen 0-60 sn jitter (LockoutJitter, RandomNumberGenerator ile) =
    // gözlemlenen kilit süresi her seferinde 4-5 dakika arasında farklı bir
    // noktada biter; sabit bir sayı olmadığı için otomatik yeniden deneme
    // zamanlaması kurulamaz.
    private int AdminLockoutMinutes
        => config.GetValue("LockoutSettings:LockoutMinutes", 4);

    private int AdminLockoutJitterMaxSeconds
        => config.GetValue("LockoutSettings:JitterMaxSeconds", 60);

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(LoginAsync), new { request.Email });

        var user = await uow.AdminUsers.GetByEmailAsync(request.Email, ct);

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.Password, user?.PasswordHash) || user is null)
        {
            if (user is not null)
            {
                var (_, failedRoleName) = await ResolveRoleContextAsync(user, ct);
                user.RecordFailedLogin(
                    config.GetValue("LockoutSettings:MaxFailedAttempts", 5),
                    AdminLockoutMinutes,
                    LockoutJitter.NextSeconds(AdminLockoutJitterMaxSeconds));
                await uow.SaveChangesAsync(ct);
                await audit.LogAsync(new AuditEntry
                {
                    Action = AuditAction.Login,
                    Result = LogResult.Failure,
                    Level = AuditLogLevel.Warning,
                    EntityType = "AdminUser",
                    EntityId = user.Id,
                    Module = "Auth",
                    Description = "Hatalı şifre",
                    ActorUserId = user.Id,
                    ActorUserName = user.FullName,
                    ActorUserRole = failedRoleName,
                }, ct);

                if (user.IsLocked)
                    await audit.LogAsync(new AuditEntry
                    {
                        Action = AuditAction.StatusChange,
                        Result = LogResult.Failure,
                        Level = AuditLogLevel.Warning,
                        EntityType = "AdminUser",
                        EntityId = user.Id,
                        Module = "Auth",
                        Description = "Hesap kilitlendi (5 hatalı deneme)",
                        ActorUserId = user.Id,
                        ActorUserName = user.FullName,
                        ActorUserRole = failedRoleName,
                    }, ct);

                // Eşiğe TAM bu denemede ulaşılmışsa (RecordFailedLogin burada kilitledi),
                // kullanıcıya hemen ACCOUNT_LOCKED dönülür — önceki halde bu istek hâlâ
                // INVALID_CREDENTIALS dönüyordu ve kilit ancak BİR SONRAKİ denemede
                // görünüyordu (2026-09-21 test bulgusu: Admin/Citizen/Company/CompanyStaff
                // lockout testleri tam eşik denemesinde ACCOUNT_LOCKED bekliyor).
                if (user.IsLocked)
                    throw new ConflictException(BuildLockedMessage(user.LockedUntil), "ACCOUNT_LOCKED");
            }
            throw new ConflictException("Email veya şifre hatalı.", "INVALID_CREDENTIALS");
        }

        if (!user.IsActive)
            throw new ConflictException("Hesabınız aktif değil.", "ACCOUNT_INACTIVE");

        if (user.IsLocked)
            // Gerçek kalan süre (LockedUntil - UtcNow) mesaja gömülür — jitter'lı kilit
            // süresi (bkz. AdminLockoutMinutes/AdminLockoutJitterMaxSeconds) her hesapta
            // farklı olduğu için burada sabit bir metin yazılamaz.
            throw new ConflictException(BuildLockedMessage(user.LockedUntil), "ACCOUNT_LOCKED");

        // Şifre burada doğrulandı — brute-force sayacı hemen sıfırlanır (asıl oturum RecordLogin
        // ile OTP doğrulandıktan sonra açılsa da, sayaç OTP'yi beklemeden sıfırlanmalı, aksi halde
        // doğru şifreyle giriş yapıp OTP bekleyen kullanıcı o sıradaki yanlış denemelerle eski
        // sayaçtan devam ederek gereğinden erken kilitlenir).
        if (user.FailedLoginCount > 0)
        {
            user.ResetFailedLoginCount();
            await uow.SaveChangesAsync(ct);
        }

        var hasActiveSessions = await CountActiveSessionsAsync(user.Id, ct) > 0;

        {
            var channel = user.TwoFactorChannel ?? (!string.IsNullOrWhiteSpace(user.Phone) ? "sms" : "email");
            var target = channel == "sms" ? (user.Phone ?? user.Email) : user.Email;
            var purpose = user.IsFirstLogin ? OtpPurpose.AccountActivation : OtpPurpose.TwoFactor;

            if (!await otpService.IsOnCooldownAsync(user.Id, purpose, ct))
                await otpService.SendAsync(user.Id, target, channel, purpose, ct);

            // 2026-09-22 bulgusu (PasswordFingerprint.cs): OTP doğrulanırken şifrenin
            // bu andan sonra değişmediğini kontrol edebilmek için parmak izi gömülür.
            var pendingToken = jwtService.GeneratePendingOtpToken(user.Id, PasswordFingerprint.Compute(user.PasswordHash));
            log.LogStepResult("OtpRequired", new { user.Id, channel });

            return new LoginResponse
            {
                RequiresOtp = true,
                OtpSessionToken = pendingToken,
                OtpChannel = channel,
                ResendCooldownSeconds = otpService.ResendCooldownSeconds,
                HasActiveSessions = hasActiveSessions,
            };
        }
    }

    public async Task<ResendOtpResponse> ResendOtpAsync(ResendOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(ResendOtpAsync), new { });

        var pending = jwtService.ValidatePendingOtpToken(request.OtpSessionToken)
            ?? throw new ConflictException("Geçersiz veya süresi dolmuş oturum.", "INVALID_SESSION");

        var user = await uow.AdminUsers.GetByIdAsync(pending.UserId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        if (PasswordFingerprint.Compute(user.PasswordHash) != pending.PwdFingerprint)
            throw new ConflictException("Şifreniz değiştirildi. Lütfen yeni şifrenizle tekrar giriş yapın.", "INVALID_SESSION");

        var purpose = user.IsFirstLogin ? OtpPurpose.AccountActivation : OtpPurpose.TwoFactor;
        await otpService.EnsureCanResendAsync(user.Id, purpose, ct);

        var channel = user.TwoFactorChannel ?? (!string.IsNullOrWhiteSpace(user.Phone) ? "sms" : "email");
        var target = channel == "sms" ? (user.Phone ?? user.Email) : user.Email;
        await otpService.SendAsync(user.Id, target, channel, purpose, ct);

        var pendingToken = jwtService.GeneratePendingOtpToken(user.Id, PasswordFingerprint.Compute(user.PasswordHash));
        return new ResendOtpResponse(pendingToken, channel, otpService.ResendCooldownSeconds);
    }

    public async Task<TokenPairDto> VerifyOtpAsync(VerifyOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(VerifyOtpAsync), new { });

        var pending = jwtService.ValidatePendingOtpToken(request.OtpSessionToken)
            ?? throw new ConflictException("Geçersiz veya süresi dolmuş oturum.", "INVALID_SESSION");
        var userId = pending.UserId;

        var user = await uow.AdminUsers.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        // 2026-09-22 bulgusu: şifre bu OTP oturumu üretildikten SONRA değiştiyse
        // (ör. paralel şifre sıfırlama/admin müdahalesi), eski şifreyle açılmış
        // bu OTP oturumu artık geçersizdir. Bkz. PasswordFingerprint.cs.
        if (PasswordFingerprint.Compute(user.PasswordHash) != pending.PwdFingerprint)
            throw new ConflictException("Şifreniz değiştirildi. Lütfen yeni şifrenizle tekrar giriş yapın.", "INVALID_SESSION");

        if (!user.IsActive)
            throw new ConflictException("Hesabınız aktif değil.", "ACCOUNT_INACTIVE");

        var purpose = user.IsFirstLogin ? OtpPurpose.AccountActivation : OtpPurpose.TwoFactor;
        await otpService.VerifyAsync(userId, purpose, request.Code, ct);

        await InvalidateAllSessionsAsync(userId, ct);

        return await IssueTokensAsync(user, ct);
    }

    public async Task<TokenPairDto> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        var key = RefreshKey(request.RefreshToken);
        var stored = await redis.GetAsync<RefreshPayload>(key, ct)
            ?? throw new ConflictException("Refresh token geçersiz veya süresi dolmuş.", "INVALID_REFRESH_TOKEN");

        var user = await uow.AdminUsers.GetByIdAsync(stored.UserId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        if (!user.IsActive)
            throw new ConflictException("Hesabınız aktif değil.", "ACCOUNT_INACTIVE");

        await redis.RemoveAsync(key, ct);

        if (stored.ImpersonatorId is null && stored.SecurityVersion != user.SecurityVersion)
            throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        if (stored.ImpersonatorId is Guid impersonatorId)
            return await IssueImpersonationTokensAsync(user, impersonatorId, ct);

        await redis.SetRemoveAsync(SessionsKey(stored.UserId), request.RefreshToken, ct);

        var newRefreshToken = jwtService.GenerateRefreshToken();
        await redis.SetAsync(RefreshKey(newRefreshToken), new RefreshPayload(user.Id, SecurityVersion: user.SecurityVersion), RefreshTokenTtl, ct);
        await redis.SetAddAsync(SessionsKey(user.Id), newRefreshToken, RefreshTokenTtl, ct);

        var sessionId = await redis.GetAsync<string>(CurrentSessionIdKey(user.Id), ct);
        if (!Guid.TryParse(sessionId, out var sid))
        {
            sid = Guid.NewGuid();
            await redis.SetAsync(CurrentSessionIdKey(user.Id), sid.ToString(), RefreshTokenTtl, ct);
        }

        var (isSuperAdmin, roleName) = await ResolveRoleContextAsync(user, ct);
        var accessToken = jwtService.GenerateAccessToken(user, isSuperAdmin, roleName, sid);
        var sessionConfig = new SessionConfigDto(
            config.GetValue("TokenSettings:Admin:InactivityTimeoutMinutes", 60));

        return new TokenPairDto(accessToken, newRefreshToken, DateTime.UtcNow.AddMinutes(AccessTokenMinutes), await BuildMeAsync(user, ct), sessionConfig);
    }

    public async Task<AdminMeResponseDto> GetMeAsync(Guid userId, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");
        var sessionConfig = new SessionConfigDto(
            config.GetValue("TokenSettings:Admin:InactivityTimeoutMinutes", 60));
        return new AdminMeResponseDto(await BuildMeAsync(user, ct), sessionConfig);
    }

    private async Task<MeDto> BuildMeAsync(AdminUser user, CancellationToken ct)
    {
        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        var isSuperAdmin = await IsSuperAdminAsync(role, ct);
        var permissions = isSuperAdmin
            ? new List<string>()
            : await GetRolePermissionKeysAsync(user.RoleId, ct);

        var scopeGroups = await userScope.GetScopeGroupsAsync(user.Id, ct);
        var scopes = scopeGroups
            .Select(g => new MeScopeDto { ModuleKey = g.ModuleKey, RefIds = g.RefIds.ToArray() })
            .ToList();

        // Eğitmen yalnız program atandığı tesis modüllerini görür; diğer tesis modülü izinleri menüden düşer.
        if (role?.Key == "tpl-egitmen")
        {
            var assignedModules = scopeGroups.Where(g => g.RefIds.Count > 0).Select(g => g.ModuleKey).ToHashSet();
            permissions = permissions
                .Where(k => k.Split('.')[0] is var m && (!FacilityModuleRegistry.IsValid(m) || assignedModules.Contains(m)))
                .ToList();
        }

        return user.Adapt<MeDto>() with
        {
            Permissions = permissions,
            Scopes = scopes,
            IsSuperAdmin = isSuperAdmin,
            RoleName = role?.Name ?? "",
            RoleColor = role?.Color,
        };
    }

    private static Task<bool> IsSuperAdminAsync(Role? role, CancellationToken ct)
        => Task.FromResult(role?.IsSuperAdmin == true);

    private async Task<(bool IsSuperAdmin, string? RoleName)> ResolveRoleContextAsync(AdminUser user, CancellationToken ct)
    {
        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        return (await IsSuperAdminAsync(role, ct), role?.Name);
    }

    private async Task<List<string>> GetRolePermissionKeysAsync(Guid roleId, CancellationToken ct)
    {
        var permissionIds = await uow.RolePermissions.GetPermissionIdsByRoleAsync(roleId, ct);
        if (permissionIds.Count == 0) return new List<string>();
        var permissions = await uow.Permissions.GetByIdsAsync(permissionIds, ct);
        return permissions.Select(p => p.Key).ToList();
    }

    public async Task LogoutAsync(Guid userId, CancellationToken ct)
    {
        await InvalidateAllSessionsAsync(userId, ct);
        await redis.SetAsync(CurrentSessionIdKey(userId), Guid.NewGuid().ToString(), RefreshTokenTtl, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Logout,
            Result = LogResult.Success,
            EntityType = "AdminUser",
            EntityId = userId,
            Module = "Auth",
            Description = "Çıkış yapıldı",
        }, ct);
    }

    // Kullanıcı isteği (2026-09-07): şifre sıfırlama e-posta VEYA telefon ile başlatılabilir.
    // Girilen metin "@" içeriyorsa e-posta, aksi halde telefon olarak aranır.
    private async Task<AdminUser?> FindByIdentifierAsync(string identifier, CancellationToken ct)
        => LoginIdentifier.LooksLikeEmail(identifier)
            ? await uow.AdminUsers.GetByEmailAsync(identifier.Trim(), ct)
            : await uow.AdminUsers.GetByPhoneAsync(identifier, ct);

    /// <summary>
    /// Kullanıcı isteği (2026-09-07, 2026-09-21): şifre sıfırlamada artık OTP
    /// kodu değil, doğrudan <b>basit bir geçici şifre</b> gönderilir. Kullanıcı
    /// bu şifreyle giriş yapar, <c>MustChangePassword</c> bayrağı sayesinde
    /// panel onu zorunlu olarak "yeni şifre belirle" ekranına yönlendirir.
    /// Üretim, hesap oluşturma akışlarıyla <b>aynı algoritmayı</b> kullanır
    /// (bkz. <see cref="PasswordGenerator"/>).
    /// <para>
    /// Kanal: hesapta telefon kayıtlıysa SMS, değilse e-posta.
    /// </para>
    /// </summary>
    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct)
    {
        var identifier = request.Value.Trim();
        var byPhone = !LoginIdentifier.LooksLikeEmail(identifier);
        var user = await FindByIdentifierAsync(identifier, ct);

        // Kullanıcı bulunamasa bile hesap varlığını sızdırmamak için başarılı görünür
        // yanıt döndürülür (hesap sayımı/keşfi saldırılarına karşı).
        if (user is null)
        {
            var guessed = byPhone ? "sms" : "email";
            return new ForgotPasswordResponse(true, guessed, MaskTarget(identifier, guessed));
        }

        if (!user.IsActive)
        {
            var guessed2 = byPhone ? "sms" : "email";
            return new ForgotPasswordResponse(true, guessed2, MaskTarget(identifier, guessed2));
        }

        var hasPhone = !string.IsNullOrWhiteSpace(user.Phone);
        var channel = hasPhone ? "sms" : "email";
        var target = hasPhone ? user.Phone! : user.Email;

        // F28: Anonim "şifremi unuttum" artık şifreyi DOĞRUDAN değiştirmez. Sahiplik kanıtı
        // için kayıtlı kanala OTP gönderilir; parola yalnız VerifyResetOtp + ResetPassword ile,
        // doğru OTP'den sonra değişir. Böylece kimliği bilen biri kullanıcıyı dışarı atamaz.
        if (!await otpService.IsOnCooldownAsync(user.Id, OtpPurpose.PasswordReset, ct))
        {
            await otpService.SendAsync(user.Id, target, channel, OtpPurpose.PasswordReset, ct);

            var (_, roleName) = await ResolveRoleContextAsync(user, ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.PasswordReset,
                Result = LogResult.Success,
                EntityType = "AdminUser",
                EntityId = user.Id,
                Module = "Auth",
                Description = $"Şifre sıfırlama OTP gönderildi (kanal: {channel})",
                ActorUserId = user.Id,
                ActorUserName = user.FullName,
                ActorUserRole = roleName,
            }, ct);
        }

        return new ForgotPasswordResponse(true, channel, MaskTarget(target, channel));
    }

    public async Task VerifyResetOtpAsync(AdminVerifyResetOtpRequest request, CancellationToken ct)
    {
        var user = await FindByIdentifierAsync(request.Value.Trim(), ct)
            ?? throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");
        try
        {
            await otpService.VerifyWithoutConsumingAsync(user.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
        }
        catch (ConflictException ex) when (ex.ErrorCode == "OTP_MISMATCH")
        {
            throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");
        }
    }

    public async Task ResetPasswordAsync(AdminResetPasswordRequest request, CancellationToken ct)
    {
        var user = await FindByIdentifierAsync(request.Value.Trim(), ct)
            ?? throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");

        Nexora.Infrastructure.Security.PasswordPolicy.EnsureValid(request.NewPassword);
        try
        {
            await otpService.VerifyWithoutConsumingAsync(user.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
            if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, user.PasswordHash))
                throw new ConflictException("Yeni şifreniz mevcut şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");
            await otpService.VerifyAsync(user.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
        }
        catch (ConflictException ex) when (ex.ErrorCode == "OTP_MISMATCH")
        {
            throw new ConflictException("Doğrulama kodu geçersiz.", "OTP_INVALID");
        }

        user.CompletePasswordChange(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        await InvalidateAllSessionsAsync(user.Id, ct);

        var (_, roleName) = await ResolveRoleContextAsync(user, ct);
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            Result = LogResult.Success,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Auth",
            Description = "Şifre OTP doğrulaması ile sıfırlandı",
            ActorUserId = user.Id,
            ActorUserName = user.FullName,
            ActorUserRole = roleName,
        }, ct);
    }

    // 2026-08-13 denetiminde bulundu: sabit "15 dakika" metni AdminUser'ın gerçek 1 dakikalık
    // kilidiyle tutarsızdı. Kalan süre buradan hesaplanıp mesaja gömülür (Participant/Company/
    // CompanyStaff akışlarında da aynı desen kullanılıyor).
    private static string BuildLockedMessage(DateTime? lockedUntil)
    {
        if (lockedUntil is null) return "Hesabınız kilitlendi. Lütfen daha sonra tekrar deneyin.";
        var remaining = lockedUntil.Value - DateTime.UtcNow;
        var seconds = Math.Max(1, (int)Math.Ceiling(remaining.TotalSeconds));
        var text = seconds < 60
            ? $"{seconds} saniye"
            : $"{Math.Ceiling(seconds / 60.0):0} dakika";
        return $"Hesabınız kilitlendi. {text} sonra tekrar deneyin.";
    }

    private static string MaskTarget(string target, string channel)
    {
        if (channel == "sms")
        {
            var digits = target.Length;
            return digits <= 4 ? target : $"•••• •• •{target[^2..]}";
        }
        var at = target.IndexOf('@');
        if (at <= 1) return target;
        return $"{target[0]}***{target[(at - 1)..]}";
    }

    public async Task ChangeInitialPasswordAsync(Guid userId, ChangeInitialPasswordRequest request, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        if (!user.MustChangePassword)
            throw new ConflictException("Şifre değişikliği gerekmiyor.", "PASSWORD_CHANGE_NOT_REQUIRED");

        // 2026-07-30 denetiminde eklendi (P1): önceden yalnızca uzunluk kontrolü
        // vardı (8 karakter), büyük harf/rakam zorunluluğu yoktu — platformdaki
        // diğer şifre değiştirme akışlarıyla (ResetPasswordRequestValidator) tutarsızdı.
        PasswordPolicy.EnsureValid(request.NewPassword);

        if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, user.PasswordHash))
            throw new ConflictException("Yeni şifreniz geçici şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");

        user.CompletePasswordChange(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        await InvalidateAllSessionsAsync(user.Id, ct);

        var (_, roleName) = await ResolveRoleContextAsync(user, ct);
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordChange,
            Result = LogResult.Success,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Auth",
            Description = "İlk giriş zorunlu şifre değişikliği tamamlandı",
            ActorUserId = user.Id,
            ActorUserName = user.FullName,
            ActorUserRole = roleName,
        }, ct);
    }

    /// <summary>
    /// Kullanıcı isteği (2026-09-07): "muhtar yönetimi sayfasında bypass ederek girsin" —
    /// belediye yöneticisinin, atanmış bir muhtarın (scope'lu AdminUser) panelini şifresini
    /// bilmeden birebir açabilmesi. Katılımcı/firma bypass akışıyla aynı desen (kısa ömürlü
    /// tek kullanımlık Redis kodu). Süper Admin hedefi kesinlikle bypass edilemez —
    /// aksi halde bir muhtar hesabıyla süper admin yetkisi devralınabilir.
    /// </summary>
    public async Task<string> GenerateBypassCodeAsync(Guid targetAdminUserId, CancellationToken ct)
    {
        var target = await uow.AdminUsers.GetByIdAsync(targetAdminUserId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        var (targetIsSuperAdmin, targetRoleName) = await ResolveRoleContextAsync(target, ct);
        if (targetIsSuperAdmin)
            throw new ForbiddenException("Süper Yönetici hesabına bypass ile giriş yapılamaz.", "SUPER_ADMIN_BYPASS_FORBIDDEN");

        if (!target.IsActive)
            throw new ConflictException("Hesap aktif değil.", "ACCOUNT_INACTIVE");

        if (currentUser.Id is not Guid impersonatorId)
            throw new ForbiddenException("Bu işlem için oturum gereklidir.", "AUTH_REQUIRED");

        var code = jwtService.GenerateRefreshToken();
        await redis.SetAsync($"bypass:admin-code:{code}", $"{target.Id}|{impersonatorId}", TimeSpan.FromSeconds(30), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            EntityType = "AdminUser",
            EntityId = target.Id,
            Module = "Admins",
            Description = $"Admin bypass kodu üretildi: {target.FullName} ({targetRoleName})",
            ActorUserId = impersonatorId,
        }, ct);

        return code;
    }

    public async Task<TokenPairDto> ExchangeBypassCodeAsync(string code, CancellationToken ct)
    {
        var stored = await redis.GetDeleteAsync<string>($"bypass:admin-code:{code}", ct)
            ?? throw new NotFoundException("Geçersiz veya süresi dolmuş bypass kodu.", "BYPASS_CODE_INVALID");

        var parts = stored.Split('|', 2);
        if (parts.Length != 2 || !Guid.TryParse(parts[0], out var userId) || !Guid.TryParse(parts[1], out var impersonatorId))
            throw new NotFoundException("Geçersiz bypass kodu.", "BYPASS_CODE_INVALID");

        var user = await uow.AdminUsers.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        if (!user.IsActive)
            throw new ConflictException("Hesap aktif değil.", "ACCOUNT_INACTIVE");

        return await IssueImpersonationTokensAsync(user, impersonatorId, ct);
    }

    private async Task<TokenPairDto> IssueImpersonationTokensAsync(Domain.Entities.Auth.AdminUser user, Guid impersonatorId, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid();
        var (isSuperAdmin, roleName) = await ResolveRoleContextAsync(user, ct);
        var accessToken = jwtService.GenerateAccessToken(user, isSuperAdmin, roleName, sessionId, impersonatorId);
        var refreshToken = jwtService.GenerateRefreshToken();
        await redis.SetAsync(RefreshKey(refreshToken), new RefreshPayload(user.Id, impersonatorId, user.SecurityVersion), RefreshTokenTtl, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Auth",
            Description = "Yönetici paneline bypass ile giriş yapıldı (impersonation)",
            ActorUserId = impersonatorId,
        }, ct);

        var sessionConfig = new SessionConfigDto(
            config.GetValue("TokenSettings:Admin:InactivityTimeoutMinutes", 60));

        return new TokenPairDto(accessToken, refreshToken, DateTime.UtcNow.AddMinutes(AccessTokenMinutes), await BuildMeAsync(user, ct), sessionConfig);
    }

    private async Task<TokenPairDto> IssueTokensAsync(Domain.Entities.Auth.AdminUser user, CancellationToken ct)
    {
        user.RecordLogin(currentUser.IpAddress);
        await uow.SaveChangesAsync(ct);

        var sessionId = Guid.NewGuid();
        await redis.SetAsync(CurrentSessionIdKey(user.Id), sessionId.ToString(), RefreshTokenTtl, ct);

        var (isSuperAdmin, roleName) = await ResolveRoleContextAsync(user, ct);
        var accessToken = jwtService.GenerateAccessToken(user, isSuperAdmin, roleName, sessionId);
        var refreshToken = jwtService.GenerateRefreshToken();
        await redis.SetAsync(RefreshKey(refreshToken), new RefreshPayload(user.Id, SecurityVersion: user.SecurityVersion), RefreshTokenTtl, ct);
        await redis.SetAddAsync(SessionsKey(user.Id), refreshToken, RefreshTokenTtl, ct);
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "AdminUser",
            EntityId = user.Id,
            Module = "Auth",
            Description = "Giriş yapıldı",
            ActorUserId = user.Id,
            ActorUserName = user.FullName,
            ActorUserRole = roleName,
        }, ct);

        var sessionConfig = new SessionConfigDto(
            config.GetValue("TokenSettings:Admin:InactivityTimeoutMinutes", 60));

        return new TokenPairDto(accessToken, refreshToken, DateTime.UtcNow.AddMinutes(AccessTokenMinutes), await BuildMeAsync(user, ct), sessionConfig);
    }

    private async Task InvalidateAllSessionsAsync(Guid userId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(userId), ct);
        foreach (var token in tokens)
            await redis.RemoveAsync(RefreshKey(token), ct);
        await redis.RemoveAsync(SessionsKey(userId), ct);
    }

    public async Task TerminateSessionsAsync(Guid userId, CancellationToken ct)
    {
        await InvalidateAllSessionsAsync(userId, ct);
        await redis.SetAsync(CurrentSessionIdKey(userId), Guid.NewGuid().ToString(), RefreshTokenTtl, ct);
    }

    private async Task<long> CountActiveSessionsAsync(Guid userId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(userId), ct);
        long live = 0;
        foreach (var token in tokens)
        {
            if (await redis.ExistsAsync(RefreshKey(token), ct))
                live++;
            else
                await redis.SetRemoveAsync(SessionsKey(userId), token, ct);
        }
        return live;
    }

    public async Task<MeDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        var fullName = request.FullName.Trim();
        if (string.IsNullOrWhiteSpace(fullName))
            throw new ValidationException("Ad Soyad boş olamaz.", new Dictionary<string, string[]> { ["fullName"] = ["Ad Soyad boş olamaz."] });

        user.UpdateSelf(fullName, request.Phone?.Trim());
        await uow.SaveChangesAsync(ct);

        return await BuildMeAsync(user, ct);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "USER_NOT_FOUND");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.CurrentPassword, user.PasswordHash))
            throw new ConflictException("Mevcut şifre hatalı.", "INVALID_CURRENT_PASSWORD");

        // 2026-07-30 denetiminde eklendi (P1): önceden yalnızca uzunluk kontrolü
        // vardı, karmaşıklık zorunluluğu yoktu. Canlı testte kanıtlandı: süper
        // yönetici hesabı dahil herhangi bir admin tamamen sayısal "12345678"
        // gibi çok zayıf bir şifreye geçebiliyordu.
        PasswordPolicy.EnsureValid(request.NewPassword);

        var newHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword);
        user.ChangePassword(user.PasswordHash, newHash);
        await uow.SaveChangesAsync(ct);

        await InvalidateAllSessionsAsync(userId, ct);
    }

    private static string RefreshKey(string token) => $"auth:refresh:{token}";
    private static string SessionsKey(Guid userId) => $"auth:user-sessions:{userId}";
    private static string CurrentSessionIdKey(Guid userId) => $"auth:current-session-id:{userId}";

    private record RefreshPayload(Guid UserId, Guid? ImpersonatorId = null, int SecurityVersion = 0);
}
