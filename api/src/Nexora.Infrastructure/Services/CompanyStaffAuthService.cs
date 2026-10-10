using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyStaffAuth;
using Nexora.Application.Features.CompanyStaffAuth.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;

namespace Nexora.Infrastructure.Services;

public class CompanyStaffAuthService(
    IUnitOfWork uow,
    IJwtService jwtService,
    IRedisService redis,
    IConfiguration config,
    IAuditService audit) : ICompanyStaffAuthService
{
    private const string Module = "CompanyStaffAuth";

    private TimeSpan RefreshTokenTtl
        => TimeSpan.FromDays(config.GetValue("TokenSettings:Mobile:RefreshTokenDays", 30));

    private int AccessTokenMinutes
        => config.GetValue("JwtSettings:AccessTokenMinutes", 60);

    // Kullanıcı isteği (2026-09-21): kilit süresi botlar tarafından tahmin edilemesin
    // diye taban süreye (4 dk) her denemede kriptografik olarak yeniden üretilen 0-60 sn
    // jitter eklenir (bkz. LockoutJitter). Önceki "15 dakika" sabiti çelişkiliydi (bkz.
    // LockoutMessage.Build, 2026-09-21 denetiminde bulundu).
    private int CompanyLockoutMinutes
        => config.GetValue("LockoutSettings:CompanyLockoutMinutes", 4);

    private int CompanyLockoutJitterMaxSeconds
        => config.GetValue("LockoutSettings:JitterMaxSeconds", 60);

    public async Task<CompanyStaffTokenPairDto> LoginAsync(CompanyStaffLoginRequest request, CancellationToken ct)
    {
        var phone = request.Phone?.Trim() ?? "";
        if (phone.Length == 0 || string.IsNullOrWhiteSpace(request.Password))
            throw new ConflictException("Telefon numarası ve şifre zorunludur.", "STAFF_CREDENTIALS_REQUIRED");

        // F24: telefon birden fazla firmada personel olarak kayıtlıysa hiçbirini seçme —
        // yanlış firma hesabına giriş/yanlış hash karşılaştırması riskini kapat.
        if (await uow.CompanyStaffs.CountByPhoneAsync(phone, ct) > 1)
            throw new ConflictException(
                "Bu telefon numarası birden fazla firmada personel olarak kayıtlı. Lütfen firma yetkilinizle iletişime geçin.",
                "IDENTIFIER_REQUIRES_CONTEXT");

        var staff = await uow.CompanyStaffs.GetByPhoneAnyCompanyAsync(phone, ct);

        // 2026-07-30 denetiminde eklendi (P1): önceden firma personeli girişinde
        // hesap bazlı brute-force kilidi hiç yoktu. Gerçek kalan süre (LockedUntil -
        // UtcNow) mesaja gömülür (2026-09-21 düzeltmesi: önceden sabit "15 dakika"
        // yazıyordu, gerçek süreyle çelişiyordu).
        if (staff is not null && staff.IsLocked)
            throw new ConflictException(LockoutMessage.Build(staff.LockedUntil), "ACCOUNT_LOCKED");

        if (!Nexora.Infrastructure.Security.TimingSafeAuth.Verify(request.Password, staff?.PasswordHash) || staff is null)
        {
            if (staff is not null)
            {
                staff.RecordFailedLogin(
                    config.GetValue("LockoutSettings:MaxFailedAttempts", 5),
                    CompanyLockoutMinutes,
                    LockoutJitter.NextSeconds(CompanyLockoutJitterMaxSeconds));
                uow.CompanyStaffs.Update(staff);
                await uow.SaveChangesAsync(ct);
            }
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Login,
                Result = LogResult.Failure,
                EntityType = "CompanyStaff",
                Module = Module,
                Description = $"Firma personeli girişi başarısız: {phone}",
            }, ct);

            // Eşiğe TAM bu denemede ulaşılmışsa hemen ACCOUNT_LOCKED dönülür (bkz.
            // AuthService.cs'teki aynı düzeltme, 2026-09-21 test bulgusu).
            if (staff is not null && staff.IsLocked)
                throw new ConflictException(LockoutMessage.Build(staff.LockedUntil), "ACCOUNT_LOCKED");
            throw new ConflictException("Telefon numarası veya şifre hatalı.", "INVALID_CREDENTIALS");
        }

        if (!staff.IsActive)
            throw new ConflictException("Hesabınız pasif durumda. Firma yetkilisiyle iletişime geçin.", "STAFF_INACTIVE");

        // 2026-08-26 denetiminde eklendi (P0, hata #1): personel girişi firmanın Status'üne hiç
        // bakmıyordu; reddedilmiş/pasif firmanın personeli login olabiliyordu.
        staff.Company.EnsureLoginAllowed();

        staff.RecordLogin();
        uow.CompanyStaffs.Update(staff);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Login,
            Result = LogResult.Success,
            EntityType = "CompanyStaff",
            EntityId = staff.Id,
            Module = Module,
            Description = $"Firma personeli girişi yapıldı: {staff.FullName}",
            ActorUserId = staff.Id,
            ActorUserName = staff.FullName,
        }, ct);

        return await IssueTokensAsync(staff, ct);
    }

    public async Task<CompanyStaffTokenPairDto> RefreshAsync(CompanyStaffRefreshRequest request, CancellationToken ct)
    {
        var key = RefreshKey(request.RefreshToken);
        var stored = await redis.GetAsync<RefreshPayload>(key, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        var staff = await uow.CompanyStaffs.GetByIdAsync(stored.StaffId, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        if (!staff.IsActive)
            throw new ConflictException("Hesabınız pasif durumda.", "STAFF_INACTIVE");

        var company = await uow.Companies.GetByIdAsync(staff.CompanyId, ct)
            ?? throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");
        company.EnsureLoginAllowed();

        await redis.RemoveAsync(key, ct);
        await redis.SetRemoveAsync(SessionsKey(stored.StaffId), request.RefreshToken, ct);

        if (stored.SecurityVersion != staff.SecurityVersion)
            throw new ConflictException("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "INVALID_REFRESH_TOKEN");

        return await IssueTokensAsync(staff, ct);
    }

    public async Task<CompanyStaffDto> GetMeAsync(Guid staffId, CancellationToken ct)
    {
        var staff = await uow.CompanyStaffs.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");
        return MapStaffDto(staff);
    }

    // Kullanıcı isteği: KVKK/sözleşme onayı ve bildirim izni onayı ayrı checkbox'lar olarak
    // alınır, kayıtta saklanır ve bir daha sorulmaz.
    public async Task<CompanyStaffDto> AcceptKvkkAsync(Guid staffId, CancellationToken ct)
    {
        var staff = await uow.CompanyStaffs.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");

        if (staff.AcceptKvkk())
        {
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                Result = LogResult.Success,
                EntityType = "CompanyStaff",
                EntityId = staff.Id,
                Module = Module,
                Description = "Firma personeli KVKK/sözleşme metnini onayladı",
            }, ct);
        }

        return MapStaffDto(staff);
    }

    public async Task<CompanyStaffDto> AcceptNotificationConsentAsync(Guid staffId, CancellationToken ct)
    {
        var staff = await uow.CompanyStaffs.GetByIdAsync(staffId, ct)
            ?? throw new NotFoundException("Personel bulunamadı.", "STAFF_NOT_FOUND");

        if (staff.AcceptNotificationConsent())
        {
            await uow.SaveChangesAsync(ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                Result = LogResult.Success,
                EntityType = "CompanyStaff",
                EntityId = staff.Id,
                Module = Module,
                Description = "Firma personeli bildirim izni sözleşmesini onayladı",
            }, ct);
        }

        return MapStaffDto(staff);
    }

    public async Task LogoutAsync(Guid staffId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(staffId), ct);
        foreach (var token in tokens)
            await redis.RemoveAsync(RefreshKey(token), ct);
        await redis.RemoveAsync(SessionsKey(staffId), ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Logout,
            Result = LogResult.Success,
            EntityType = "CompanyStaff",
            EntityId = staffId,
            Module = Module,
            Description = "Firma personeli çıkışı yapıldı",
        }, ct);
    }

    // Personel deaktive edildiğinde/silindiğinde/izinleri (canRedeem, canManageCampaigns)
    // düşürüldüğünde çağrılmalı. LogoutAsync'in aksine, sadece refresh token'ları silmekle
    // kalmaz — access token'ın kendisini de (sessionId claim'i üzerinden) anında geçersiz kılar.
    // Aksi halde eski token, izinleri düşürülmüş/deaktif edilmiş bir personelin elinde kalan
    // stale claim'lerle (canRedeem=true vb.) süresi dolana kadar çalışmaya devam eder
    // (bkz. company-staff-oturum-sonlandirma-eksigi-2026-07-30, P0).
    public async Task TerminateSessionsAsync(Guid staffId, CancellationToken ct)
    {
        var tokens = await redis.SetMembersAsync(SessionsKey(staffId), ct);
        foreach (var token in tokens)
        {
            var payload = await redis.GetAsync<RefreshPayload>(RefreshKey(token), ct);
            if (payload is not null && payload.SessionId != Guid.Empty)
                await BlockSessionAsync(payload.SessionId.ToString(), ct);
            await redis.RemoveAsync(RefreshKey(token), ct);
        }
        await redis.RemoveAsync(SessionsKey(staffId), ct);
    }

    private async Task BlockSessionAsync(string sessionId, CancellationToken ct)
        => await redis.SetAsync($"auth:revoked-session:{sessionId}", 1, TimeSpan.FromMinutes(AccessTokenMinutes + 5), ct);

    private async Task<CompanyStaffTokenPairDto> IssueTokensAsync(CompanyStaff staff, CancellationToken ct)
    {
        var sessionId = Guid.NewGuid();
        var accessToken = jwtService.GenerateCompanyStaffAccessToken(staff, sessionId);
        var refreshToken = jwtService.GenerateRefreshToken();

        await redis.SetAsync(RefreshKey(refreshToken), new RefreshPayload(staff.Id, sessionId, staff.SecurityVersion), RefreshTokenTtl, ct);
        await redis.SetAddAsync(SessionsKey(staff.Id), refreshToken, RefreshTokenTtl, ct);

        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(staff.CompanyId, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        return new CompanyStaffTokenPairDto(
            accessToken,
            refreshToken,
            DateTime.UtcNow.AddMinutes(AccessTokenMinutes),
            MapStaffDto(staff),
            MapCompanyDto(company));
    }

    private static CompanyStaffDto MapStaffDto(CompanyStaff s)
        => new(s.Id, s.CompanyId, s.FullName, s.Phone, s.Email, s.IsActive, s.CanRedeem, s.CanManageCampaigns, s.LastLoginAt, s.CreatedAt,
            s.KvkkAcceptedAt.HasValue, s.NotificationConsentAcceptedAt.HasValue);

    private static CompanySocialMediaDto? MapSocialDto(CompanySocialMedia? social)
        => social is null ? null : new CompanySocialMediaDto(social.Facebook, social.Instagram, social.Twitter, social.Linkedin);

    private static CompanyDto MapCompanyDto(Company c)
        => new(
            c.Id, c.Name, c.TaxNumber, c.Phone, c.Email, c.Address, c.District,
            c.Status.ToString(), c.EmailVerified, c.PhoneVerified,
            c.Logo, c.BannerImage, c.BannerImageMobile, c.Description, c.Website, MapSocialDto(c.SocialMedia),
            c.Latitude, c.Longitude, c.RejectReason,
            c.ServiceCategory is not null ? new ServiceCategoryRefDto(c.ServiceCategory.Id, c.ServiceCategory.Name, c.ServiceCategory.Color) : null,
            0, 0, c.CreatedAt, c.UpdatedAt, c.GalleryImages, c.ServiceDescription,
            c.KvkkAcceptedAt.HasValue, c.NotificationConsentAcceptedAt.HasValue);

    private static string RefreshKey(string token) => $"auth:company-staff-refresh:{token}";
    private static string SessionsKey(Guid staffId) => $"auth:company-staff-sessions:{staffId}";

    private record RefreshPayload(Guid StaffId, Guid SessionId = default, int SecurityVersion = 0);
}
