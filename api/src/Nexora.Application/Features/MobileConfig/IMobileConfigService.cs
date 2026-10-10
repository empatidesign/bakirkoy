using Nexora.Application.Features.MobileConfig.Dtos;
using Nexora.Domain.Enums;

namespace Nexora.Application.Features.MobileConfig;

public interface IMobileConfigService
{
    Task<MobileAppConfigDto> GetForClientAsync(string? clientVersion, MobilePlatform? platform, CancellationToken ct);

    Task<MobileAppConfigAdminDto> GetAdminAsync(CancellationToken ct);

    Task<MobileAppConfigAdminDto> UpdateWebViewAsync(UpdateMobileWebViewRequest req, CancellationToken ct);
    Task<MobileAppConfigAdminDto> UpdateVersionControlAsync(UpdateVersionControlRequest req, CancellationToken ct);
    Task<MobileAppConfigAdminDto> UpdateSplashImageAsync(UpdateSplashImageRequest req, CancellationToken ct);
    Task<MobileAppConfigAdminDto> UpdateHomeLogoAsync(UpdateMobileLogoRequest req, CancellationToken ct);
    Task<MobileAppConfigAdminDto> UpdateTabBarLogoAsync(UpdateMobileLogoRequest req, CancellationToken ct);
    Task<MobileAppConfigAdminDto> UpdateOnboardingImagesAsync(UpdateOnboardingImagesRequest req, CancellationToken ct);
    Task<string> UploadOnboardingImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<string> UploadLogoAsync(Stream stream, string fileName, string contentType, CancellationToken ct);

    /// <summary>Yüklenen görseli depoya yazar ve erişim adresini döner.</summary>
    Task<string> UploadSplashImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);

    Task<MobileAppConfigAdminDto> UpdateLegalDocumentsAsync(UpdateLegalDocumentsRequest req, CancellationToken ct);

    // ---- Hızlı işlem kartları ----
    Task<IReadOnlyList<MobileQuickActionAdminDto>> GetQuickActionsAsync(CancellationToken ct);
    Task<MobileQuickActionAdminDto> CreateQuickActionAsync(SaveMobileQuickActionRequest req, CancellationToken ct);
    Task<MobileQuickActionAdminDto> UpdateQuickActionAsync(Guid id, SaveMobileQuickActionRequest req, CancellationToken ct);
    Task DeleteQuickActionAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<MobileQuickActionAdminDto>> ReorderQuickActionsAsync(ReorderMobileQuickActionsRequest req, CancellationToken ct);
}
