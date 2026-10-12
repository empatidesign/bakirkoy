using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyAuth;
using Nexora.Application.Features.CompanyAuth.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;

namespace Nexora.Infrastructure.Services;

public class CompanyAuthService(
    IUnitOfWork uow,
    IJwtService jwtService,
    IOtpService otpService,
    IRedisService redis,
    IConfiguration config,
    IAuditService audit,
    IActivityLogger log) : ICompanyAuthService
{
    private const string Module = "CompanyAuth";

    private TimeSpan RefreshTokenTtl
        => TimeSpan.FromDays(config.GetValue("TokenSettings:Mobile:RefreshTokenDays", 30));

    private int AccessTokenMinutes
        => config.GetValue("JwtSettings:AccessTokenMinutes", 60);

    private TimeSpan HandoffCodeTtl
        => TimeSpan.FromSeconds(config.GetValue("HandoffSettings:CodeTtlSeconds", 30));

    // Kullanıcı isteği (2026-09-21): kilit süresi botlar tarafından tahmin edilemesin
    // diye taban süreye (4 dk) her denemede kriptografik olarak yeniden üretilen 0-60 sn
    // jitter eklenir (bkz. LockoutJitter). Önceki "15 dakika" sabiti hem çok uzundu hem de
    // gerçek kalan süreyle hiç uyuşmayan sabit bir hata mesajı üretiyordu (2026-09-21
    // denetiminde bulundu, bkz. LockoutMessage.Build).
    private int CompanyLockoutMinutes
        => config.GetValue("LockoutSettings:CompanyLockoutMinutes", 4);

    private int CompanyLockoutJitterMaxSeconds
        => config.GetValue("LockoutSettings:JitterMaxSeconds", 60);

    public async Task<CompanyRegisterResultDto> RegisterAsync(CompanyRegisterRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(RegisterAsync), new { request.Email, request.Phone, request.TaxNumber });

        if (await uow.Companies.ExistsByPhoneAsync(request.Phone, null, ct))
            throw new ConflictException("Bu telefon numarası ile kayıtlı firma var.", "DUPLICATE_PHONE");

        if (!string.IsNullOrWhiteSpace(request.Email) && await uow.Companies.ExistsByEmailAsync(request.Email, null, ct))
            throw new ConflictException("Bu e-posta ile kayıtlı firma var.", "DUPLICATE_EMAIL");

        if (await uow.Companies.ExistsByTaxNumberAsync(request.TaxNumber, null, ct))
            throw new ConflictException("Bu vergi numarası ile kayıtlı firma var.", "DUPLICATE_TAX_NUMBER");

        var passwordHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.Password);

        var company = Company.Create(
            request.Name,
            request.TaxNumber,
            request.Phone,
            request.Email,
            request.Address,
            string.IsNullOrWhiteSpace(request.District) ? "Bakırköy" : request.District,
            passwordHash);

        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            company.UpdateProfile(company.Name, company.Phone, company.Email, company.Address, company.District,
                company.Logo, company.BannerImage, company.Description, company.Website, company.SocialMedia,
                request.Latitude, request.Longitude, bannerImageMobile: company.BannerImageMobile);
        }

        company.SetServiceCategory(request.ServiceCategoryId);

        if (request.KvkkAccepted) company.AcceptKvkk();
        if (request.NotificationConsentAccepted) company.AcceptNotificationConsent();

        await uow.Companies.AddAsync(company, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma kaydı oluşturuldu (onay bekliyor): {company.Name}",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return new CompanyRegisterResultDto(true, "Kaydınız alındı, onay bekleniyor.");
    }

    public async Task<CompanyLoginResponseDto> LoginAsync(CompanyLoginRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(LoginAsync), new { });

        var company = await ResolveByIdentifierAsync(request.Identifier, ct);

        // 2026-07-30 denetiminde eklendi (P1): önceden firma girişinde hesap bazlı
        // brute-force kilidi hiç yoktu. Gerçek kalan süre (LockedUntil - UtcNow) mesaja
        // gömülür (2026-09-21 düzeltmesi: önceden sabit "15 dakika" yazıyordu, gerçek
        // sürenin 4-5 dakika olduğu durumlarda bile).
        if (company is not null && company.IsLocked)
            throw new ConflictException(LockoutMessage.Build(company.LockedUntil), "ACCOUNT_LOCKED");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.Password, company?.PasswordHash) || company is null)
        {
            if (company is not null)
            {
                company.RecordFailedLogin(
                    config.GetValue("LockoutSettings:MaxFailedAttempts", 5),
                    CompanyLockoutMinutes,
                    LockoutJitter.NextSeconds(CompanyLockoutJitterMaxSeconds));
                uow.Companies.Update(company);
                await uow.SaveChangesAsync(ct);

                // Eşiğe TAM bu denemede ulaşılmışsa hemen ACCOUNT_LOCKED dönülür (bkz.
                // AuthService.cs'teki aynı düzeltme, 2026-09-21 test bulgusu).
                if (company.IsLocked)
                    throw new ConflictException(LockoutMessage.Build(company.LockedUntil), "ACCOUNT_LOCKED");
            }
            throw new ConflictException("Telefon/e-posta veya şifre hatalı.", "INVALID_CREDENTIALS");
        }

        company.RecordSuccessfulLogin();
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        company.EnsureLoginAllowed();

        var (channel, target, masked) = ResolveOtpChallenge(company);

        if (!await otpService.IsOnCooldownAsync(company.Id, OtpPurpose.TwoFactor, ct))
            await otpService.SendAsync(company.Id, target, channel, OtpPurpose.TwoFactor, ct);

        // 2026-09-22 bulgusu (PasswordFingerprint.cs): OTP doğrulanırken şifrenin
        // bu andan sonra değişmediğini kontrol edebilmek için parmak izi gömülür.
        var otpSessionToken = jwtService.GeneratePendingOtpToken(company.Id, PasswordFingerprint.Compute(company.PasswordHash));
        log.LogStepResult("OtpRequired", new { company.Id, channel });

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = "Firma giriş OTP gönderildi",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return new CompanyLoginResponseDto(true, otpSessionToken, channel, masked, otpService.ResendCooldownSeconds);
    }

    public async Task<CompanyTokenPairDto> VerifyOtpAsync(CompanyVerifyOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(VerifyOtpAsync), new { });

        var pending = jwtService.ValidatePendingOtpToken(request.OtpSessionToken)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "OTP_SESSION_EXPIRED");
        var companyId = pending.UserId;

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        // 2026-09-22 bulgusu: şifre bu OTP oturumu üretildikten SONRA değiştiyse
        // (ör. paralel "şifremi unuttum" akışı), eski şifreyle açılmış bu OTP
        // oturumu artık geçersizdir. Bkz. PasswordFingerprint.cs.
        if (PasswordFingerprint.Compute(company.PasswordHash) != pending.PwdFingerprint)
            throw new ConflictException("Şifreniz değiştirildi. Lütfen yeni şifrenizle tekrar giriş yapın.", "OTP_SESSION_EXPIRED");

        company.EnsureLoginAllowed();

        await otpService.VerifyAsync(companyId, OtpPurpose.TwoFactor, request.Code, ct);

        var pair = await IssueTokensAsync(company, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = "Firma girişi yapıldı",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);

        return pair;
    }

    public async Task<CompanyOtpChallengeDto> ResendOtpAsync(CompanyResendOtpRequest request, CancellationToken ct)
    {
        log.LogStep(nameof(ResendOtpAsync), new { });

        var companyId = jwtService.ValidatePendingOtpToken(request.OtpSessionToken)?.UserId
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "OTP_SESSION_EXPIRED");

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        await otpService.EnsureCanResendAsync(companyId, OtpPurpose.TwoFactor, ct);

        var (channel, target, masked) = ResolveOtpChallenge(company);

        await otpService.SendAsync(companyId, target, channel, OtpPurpose.TwoFactor, ct);

        return new CompanyOtpChallengeDto(channel, masked, otpService.ResendCooldownSeconds);
    }

    public async Task<CompanyTokenPairDto> RefreshAsync(CompanyRefreshRequest request, CancellationToken ct)
    {
        var key = RefreshKey(request.RefreshToken);
        var stored = await redis.GetAsync<RefreshPayload>(key, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        var company = await uow.Companies.GetByIdAsync(stored.CompanyId, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        company.EnsureLoginAllowed();

        await redis.RemoveAsync(key, ct);
        await redis.SetRemoveAsync(SessionsKey(stored.CompanyId), request.RefreshToken, ct);

        if (stored.SecurityVersion != company.SecurityVersion)
            throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        return await IssueTokensAsync(company, ct);
    }

    public async Task<CompanyDto> GetMeAsync(Guid companyId, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        return await BuildCompanyDtoAsync(company, ct);
    }

    // Kullanıcı isteği: KVKK/sözleşme onayı ve bildirim izni onayı ayrı checkbox'lar olarak
    // alınır, kayıtta saklanır ve bir daha sorulmaz.
    public async Task<CompanyDto> AcceptKvkkAsync(Guid companyId, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (company.AcceptKvkk())
        {
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                Result = LogResult.Success,
                EntityType = "Company",
                EntityId = company.Id,
                Module = Module,
                Description = "Firma KVKK/sözleşme metnini onayladı",
            }, ct);
        }

        return await BuildCompanyDtoAsync(company, ct);
    }

    public async Task<CompanyDto> AcceptNotificationConsentAsync(Guid companyId, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (company.AcceptNotificationConsent())
        {
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                Result = LogResult.Success,
                EntityType = "Company",
                EntityId = company.Id,
                Module = Module,
                Description = "Firma bildirim izni sözleşmesini onayladı",
            }, ct);
        }

        return await BuildCompanyDtoAsync(company, ct);
    }

    public async Task LogoutAsync(Guid companyId, CancellationToken ct)
    {
        await InvalidateAllSessionsAsync(companyId, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Logout,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = companyId,
            Module = Module,
            Description = "Firma çıkışı yapıldı",
        }, ct);
    }

    public async Task<CompanyForgotPasswordResultDto> ForgotPasswordAsync(CompanyForgotPasswordRequest request, CancellationToken ct)
    {
        var company = await ResolveByIdentifierAsync(request.Identifier, ct)
            ?? throw new NotFoundException("Bu telefon numarası veya e-posta ile kayıtlı bir firma bulunamadı.", "COMPANY_NOT_FOUND");

        var (channel, target) = ResolveOtpTarget(company);
        if (target is null)
            throw new ConflictException("Firmanızda doğrulama kodu gönderilebilecek bir telefon numarası veya e-posta bulunmuyor. Lütfen belediyeye başvurun.", "NO_OTP_TARGET");

        if (!await otpService.IsOnCooldownAsync(company.Id, OtpPurpose.PasswordReset, ct))
        {
            await otpService.SendAsync(company.Id, target, channel, OtpPurpose.PasswordReset, ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.PasswordReset,
                Result = LogResult.Success,
                EntityType = "Company",
                EntityId = company.Id,
                Module = Module,
                Description = "Şifre sıfırlama OTP gönderildi",
                ActorUserId = company.Id,
                ActorUserName = company.Name,
            }, ct);
        }

        var masked = channel == "sms" ? MaskPhone(target) : MaskEmail(target);
        return new CompanyForgotPasswordResultDto(channel, masked, otpService.ResendCooldownSeconds);
    }

    public async Task VerifyResetOtpAsync(CompanyVerifyResetOtpRequest request, CancellationToken ct)
    {
        var company = await ResolveByIdentifierAsync(request.Identifier, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        await otpService.VerifyWithoutConsumingAsync(company.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
    }

    public async Task ResetPasswordAsync(CompanyResetPasswordRequest request, CancellationToken ct)
    {
        var company = await ResolveByIdentifierAsync(request.Identifier, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        Nexora.Infrastructure.Security.PasswordPolicy.EnsureValid(request.NewPassword, "newPassword");
        await otpService.VerifyWithoutConsumingAsync(company.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);
        if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, company.PasswordHash))
            throw new ConflictException("Yeni şifreniz mevcut şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");

        await otpService.VerifyAsync(company.Id, OtpPurpose.PasswordReset, request.OtpCode, ct);

        company.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        await InvalidateAllSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = "Firma şifresi sıfırlandı",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);
    }

    public async Task ChangeInitialPasswordAsync(Guid companyId, CompanyChangeInitialPasswordRequest request, CancellationToken ct)
    {
        // 2026-08-13 denetiminde bulundu: backend'in gerçek son-savunma kontrolü yalnızca
        // 6 karakter uzunluk şartı arıyordu (büyük harf/rakam zorunluluğu yoktu) — sistemin
        // geri kalanındaki ortak PasswordPolicy'den (8 karakter + büyük harf + rakam, bkz.
        // 2026-07-30 denetimi) belirgin şekilde zayıftı. Frontend (isStrongPassword) zaten
        // güçlü şifre istiyordu ama bu uçta hiç FluentValidation validator'ı da çalışmıyordu
        // (bkz. CompanyAuthEndpoints.ChangeInitial) — backend tek başına bırakılınca zayıf
        // "123456" gibi bir şifre kabul edilebiliyordu.
        Nexora.Infrastructure.Security.PasswordPolicy.EnsureValid(request.NewPassword, "newPassword");

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (!company.IsFirstLogin)
            throw new ConflictException("Şifre değişikliği gerekmiyor.", "PASSWORD_CHANGE_NOT_REQUIRED");

        if (Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.NewPassword, company.PasswordHash))
            throw new ConflictException("Yeni şifreniz geçici şifrenizle aynı olamaz.", "SAME_AS_CURRENT_PASSWORD");

        company.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        await InvalidateAllSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordChange,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = "Firma ilk giriş şifresini değiştirdi",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);
    }

    public async Task ChangePasswordAsync(Guid companyId, CompanyChangePasswordRequest request, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.CurrentPassword, company.PasswordHash))
            throw new ConflictException("Mevcut şifreniz hatalı.", "INVALID_PASSWORD");

        company.CompleteInitialPassword(Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(request.NewPassword));
        await uow.SaveChangesAsync(ct);

        await InvalidateAllSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordChange,
            Result = LogResult.Success,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = "Firma şifresini kendi panelinden değiştirdi",
            ActorUserId = company.Id,
            ActorUserName = company.Name,
        }, ct);
    }

    public async Task<string> GenerateBypassCodeAsync(Guid companyId, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var code = jwtService.GenerateRefreshToken();
        await redis.SetAsync($"bypass:company-code:{code}", companyId.ToString(), TimeSpan.FromSeconds(30), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Admin bypass kodu üretildi: {company.Name}",
        }, ct);

        return code;
    }

    public async Task<CompanyTokenPairDto> ExchangeBypassCodeAsync(string code, CancellationToken ct)
    {
        var idStr = await redis.GetDeleteAsync<string>($"bypass:company-code:{code}", ct)
            ?? throw new NotFoundException("Geçersiz veya süresi dolmuş bypass kodu.", "BYPASS_CODE_INVALID");

        if (!Guid.TryParse(idStr, out var companyId))
            throw new NotFoundException("Geçersiz bypass kodu.", "BYPASS_CODE_INVALID");

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        return await IssueTokensAsync(company, ct);
    }

    public async Task<string> GenerateHandoffCodeAsync(Guid companyId, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        company.EnsureLoginAllowed();
        var code = jwtService.GenerateRefreshToken();
        await redis.SetAsync(HandoffKey(code), company.Id.ToString(), HandoffCodeTtl, ct);
        return code;
    }

    public async Task<CompanyTokenPairDto> ExchangeHandoffCodeAsync(string code, CancellationToken ct)
    {
        var idStr = await redis.GetDeleteAsync<string>(HandoffKey(code), ct)
            ?? throw new NotFoundException("Bağlantının süresi doldu. Lütfen uygulamayı yeniden açın.", "HANDOFF_CODE_INVALID");

        if (!Guid.TryParse(idStr, out var companyId))
            throw new NotFoundException("Bağlantı geçersiz. Lütfen uygulamayı yeniden açın.", "HANDOFF_CODE_INVALID");

        var company = await uow.Companies.GetByIdAsync(companyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        company.EnsureLoginAllowed();
        return await IssueTokensAsync(company, ct);
    }

    public async Task TerminateSessionsAsync(Guid companyId, CancellationToken ct)
        => await InvalidateAllSessionsAsync(companyId, ct);

    private async Task<CompanyTokenPairDto> IssueTokensAsync(Company company, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid();
        var accessToken = jwtService.GenerateCompanyAccessToken(company, sessionId);
        var refreshToken = jwtService.GenerateRefreshToken();

        await redis.SetAsync(RefreshKey(refreshToken), new RefreshPayload(company.Id, sessionId, company.SecurityVersion), RefreshTokenTtl, ct);
        await redis.SetAddAsync(SessionsKey(company.Id), refreshToken, RefreshTokenTtl, ct);

        var companyWithCategory = await uow.Companies.GetByIdWithServiceCategoryAsync(company.Id, ct) ?? company;

        return new CompanyTokenPairDto(
            accessToken,
            refreshToken,
            DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
            await BuildCompanyDtoAsync(companyWithCategory, ct),
            BuildSessionConfig(),
            company.IsFirstLogin);
    }

    private CompanySessionConfigDto BuildSessionConfig()
        => new(
            config.GetValue("TokenSettings:Web:InactivityTimeoutMinutes", 15),
            config.GetValue("TokenSettings:Mobile:InactivityTimeoutMinutes", 0));

    private async Task InvalidateAllSessionsAsync(Guid companyId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(companyId), ct);
        foreach (var token in tokens)
        {
            var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
            if (payload is not null && payload.SessionId != Guid.Empty)
                await BlockSessionAsync(payload.SessionId.ToString(), ct);
            await redis.RemoveAsync(RefreshKey(token), ct);
        }
        await redis.RemoveAsync(SessionsKey(companyId), ct);
    }

    private async Task BlockSessionAsync(string sessionId, CancellationToken ct)
        => await redis.SetAsync($"auth:revoked-session:{sessionId}", 1, TimeSpan.FromMinutes(AccessTokenMinutes + 5), ct);

    private async Task<CompanyDto> BuildCompanyDtoAsync(Company company, CancellationToken ct)
    {
        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    private async Task<Company?> ResolveByIdentifierAsync(string identifier, CancellationToken ct)
    {
        var value = identifier?.Trim() ?? "";
        if (value.Length == 0)
            return null;

        if (value.Contains('@'))
            return await uow.Companies.GetByEmailAsync(value, ct);

        return await uow.Companies.GetByPhoneAsync(value, ct);
    }

    private (string Channel, string Target, string Masked) ResolveOtpChallenge(Company company)
    {
        var (channel, target) = ResolveOtpTarget(company);
        if (target is null)
            throw new ConflictException("İletişim bilgisi bulunamadı. Doğrulama kodu gönderilemedi. Lütfen belediye ile iletişime geçin.", "OTP_TARGET_NOT_FOUND");

        var masked = channel == "sms" ? MaskPhone(target) : MaskEmail(target);
        return (channel, target, masked);
    }

    private static (string Channel, string? Target) ResolveOtpTarget(Company company)
    {
        if (!string.IsNullOrWhiteSpace(company.Phone))
            return ("sms", company.Phone);

        if (!string.IsNullOrWhiteSpace(company.Email))
            return ("email", company.Email);

        return ("sms", null);
    }

    private static CompanySocialMediaDto? MapSocialDto(CompanySocialMedia? social)
        => social is null ? null : new CompanySocialMediaDto(social.Facebook, social.Instagram, social.Twitter, social.Linkedin);

    private static CompanyDto MapDto(Company c, int totalCampaigns, int totalUsages)
        => new(
            c.Id, c.Name, c.TaxNumber, c.Phone, c.Email, c.Address, c.District,
            c.Status.ToString(), c.EmailVerified, c.PhoneVerified,
            c.Logo, c.BannerImage, c.BannerImageMobile, c.Description, c.Website, MapSocialDto(c.SocialMedia),
            c.Latitude, c.Longitude, c.RejectReason,
            c.ServiceCategory is not null ? new ServiceCategoryRefDto(c.ServiceCategory.Id, c.ServiceCategory.Name, c.ServiceCategory.Color) : null,
            totalCampaigns, totalUsages, c.CreatedAt, c.UpdatedAt, c.GalleryImages, c.ServiceDescription,
            c.KvkkAcceptedAt.HasValue, c.NotificationConsentAcceptedAt.HasValue);

    private static string MaskPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length < 4)
            return "***";
        var prefix = digits[..Math.Min(4, digits.Length - 2)];
        var suffix = digits[^2..];
        return $"{prefix}***{suffix}";
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0)
            return "***";
        var local = email[..at];
        var domain = email[(at + 1)..];
        var maskedLocal = local.Length <= 1 ? local : $"{local[0]}***";
        var dot = domain.LastIndexOf('.');
        var maskedDomain = dot > 0 ? $"***{domain[dot..]}" : "***";
        return $"{maskedLocal}@{maskedDomain}";
    }

    private static string RefreshKey(string token) => $"auth:company-refresh:{token}";
    private static string SessionsKey(Guid companyId) => $"auth:company-sessions:{companyId}";
    private static string HandoffKey(string code) => $"handoff:company-code:{code}";

    private record RefreshPayload(Guid CompanyId, Guid SessionId = default, int SecurityVersion = 0);
}
