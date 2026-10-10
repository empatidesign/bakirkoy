using Nexora.Domain.Enums;

namespace Nexora.Application.Features.MobileConfig.Dtos;

public record MobileAppConfigDto(
    MobileWebViewDto WebView,
    LegalDocumentsDto LegalDocuments,
    MobileVersionCheckDto VersionCheck,
    MobileSplashDto Splash,
    MobileLogosDto Logos,
    IReadOnlyList<MobileQuickActionDto> QuickActions,
    IReadOnlyList<string> OnboardingImages);

/// <summary>Tab bar orta butonundaki hızlı işlem kartı — istemciye giden hali.</summary>
public record MobileQuickActionDto(
    string Target,
    string Label,
    string Icon,
    string Color,
    bool RequiresAuth,
    string? TargetUrl);

public record MobileQuickActionAdminDto(
    Guid Id,
    string Target,
    string Label,
    string Icon,
    string Color,
    int SortOrder,
    bool IsActive,
    bool RequiresAuth,
    string? TargetUrl,
    DateTime? UpdatedAt);

/// <summary>Panelin hedef açılır listesini doldurduğu kayıt.</summary>
public record MobileQuickActionTargetDto(
    string Target,
    string DisplayName,
    bool RequiresUrl);

public record SaveMobileQuickActionRequest(
    string Target,
    string Label,
    string Icon,
    string Color,
    bool IsActive,
    bool RequiresAuth,
    string? TargetUrl);

public record ReorderMobileQuickActionsRequest(IReadOnlyList<Guid> OrderedIds);

/// <summary>Açılış ekranı görünümü. ImageUrl boşsa uygulama paketli logoya düşer.</summary>
public record MobileSplashDto(string? ImageUrl);

public record MobileLogosDto(string? HomeLogoUrl, string? TabBarLogoUrl);

/// <summary>
/// İstemciye "ne yapman gerekiyor" cevabı. Sürüm karşılaştırması sunucuda
/// yapılır; istemci sadece <see cref="Status"/> değerine göre ekran gösterir.
/// </summary>
public record MobileVersionCheckDto(
    MobileUpdateStatus Status,
    string? LatestVersion,
    string? MinVersion,
    string? StoreUrl,
    string? Message,
    string? ReleaseNotes);

public record LegalDocumentsDto(
    string CitizenKvkk, string CitizenNotification,
    string CompanyKvkk, string CompanyNotification,
    string CompanyStaffKvkk, string CompanyStaffNotification);

public record MobileWebViewDto(bool Enabled, string? Url, string? Message);

public record MobileAppConfigAdminDto(
    bool WebViewEnabled,
    string WebViewUrl,
    string? WebViewMaxVersion,
    string? WebViewMessage,
    string? AndroidMinVersion,
    string? AndroidLatestVersion,
    string? AndroidStoreUrl,
    string? IosMinVersion,
    string? IosLatestVersion,
    string? IosStoreUrl,
    string? UpdateMessage,
    string? UpdateReleaseNotes,
    string? SplashImageUrl,
    string? HomeLogoUrl,
    string? TabBarLogoUrl,
    IReadOnlyList<string> OnboardingImageUrls,
    LegalDocumentsDto LegalDocuments,
    DateTime? UpdatedAt);

public record UpdateMobileWebViewRequest(
    bool Enabled,
    string Url,
    string? MaxVersion,
    string? Message);

public record UpdateVersionControlRequest(
    string? AndroidMinVersion,
    string? AndroidLatestVersion,
    string? AndroidStoreUrl,
    string? IosMinVersion,
    string? IosLatestVersion,
    string? IosStoreUrl,
    string? UpdateMessage,
    string? UpdateReleaseNotes);

public record UpdateSplashImageRequest(string? ImageUrl);

public record UpdateMobileLogoRequest(string? ImageUrl);

public record UpdateOnboardingImagesRequest(IReadOnlyList<string> ImageUrls);

public record UpdateLegalDocumentsRequest(
    string CitizenKvkk, string CitizenNotification,
    string CompanyKvkk, string CompanyNotification,
    string CompanyStaffKvkk, string CompanyStaffNotification);
