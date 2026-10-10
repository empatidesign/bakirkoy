using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.MobileConfig;

public class MobileAppConfig : BaseEntity
{
    public static readonly Guid SingletonId = new("00000000-0000-0000-0000-00000000c0f1");

    public bool WebViewEnabled { get; private set; }

    public string WebViewUrl { get; private set; } = string.Empty;

    public string? WebViewMaxVersion { get; private set; }

    public string? WebViewMessage { get; private set; }

    // ---- Sürüm kontrolü (zorunlu / opsiyonel güncelleme) ----
    // Platform başına ayrı tutulur: Play Store ve App Store yayın onayları
    // aynı anda çıkmaz, bu yüzden tek bir ortak sürüm numarası iOS'ta henüz
    // yayınlanmamış bir sürümü zorunlu kılabilirdi.

    /// <summary>Bu sürümün ALTINDAKİ Android istemciler kapatılamaz güncelleme ekranı görür.</summary>
    public string? AndroidMinVersion { get; private set; }

    /// <summary>Store'daki güncel Android sürümü. Altındakilere atlanabilir uyarı gösterilir.</summary>
    public string? AndroidLatestVersion { get; private set; }

    /// <summary>Android mağaza adresi. Boşsa istemci kendi varsayılanını kullanır.</summary>
    public string? AndroidStoreUrl { get; private set; }

    /// <summary>Bu sürümün ALTINDAKİ iOS istemciler kapatılamaz güncelleme ekranı görür.</summary>
    public string? IosMinVersion { get; private set; }

    /// <summary>Store'daki güncel iOS sürümü. Altındakilere atlanabilir uyarı gösterilir.</summary>
    public string? IosLatestVersion { get; private set; }

    /// <summary>iOS mağaza adresi. Boşsa istemci kendi varsayılanını kullanır.</summary>
    public string? IosStoreUrl { get; private set; }

    /// <summary>Güncelleme ekranında gösterilecek mesaj (ör. "Yeni özellikler eklendi").</summary>
    public string? UpdateMessage { get; private set; }

    /// <summary>Sürüm notları — opsiyonel güncelleme uyarısında listelenir.</summary>
    public string? UpdateReleaseNotes { get; private set; }

    /// <summary>
    /// Açılış (splash) ekranında gösterilen görselin adresi. Boşsa uygulama
    /// kendi paketli logosunu kullanır — görsel indirilemese bile açılış
    /// ekranı boş kalmaz.
    /// </summary>
    public string? SplashImageUrl { get; private set; }

    public string? HomeLogoUrl { get; private set; }

    public string? TabBarLogoUrl { get; private set; }

    public List<string> OnboardingImageUrls { get; private set; } = [];

    public string CitizenKvkkText { get; private set; } = string.Empty;
    public string CitizenNotificationText { get; private set; } = string.Empty;
    public string CompanyKvkkText { get; private set; } = string.Empty;
    public string CompanyNotificationText { get; private set; } = string.Empty;
    public string CompanyStaffKvkkText { get; private set; } = string.Empty;
    public string CompanyStaffNotificationText { get; private set; } = string.Empty;

    public static MobileAppConfig CreateDefault()
        => new()
        {
            Id = SingletonId,
            WebViewEnabled = false,
            WebViewUrl = string.Empty,
            CitizenKvkkText = LegalDocumentDefaults.CitizenKvkk,
            CitizenNotificationText = LegalDocumentDefaults.CitizenNotification,
            CompanyKvkkText = LegalDocumentDefaults.CompanyKvkk,
            CompanyNotificationText = LegalDocumentDefaults.CompanyNotification,
            CompanyStaffKvkkText = LegalDocumentDefaults.CompanyStaffKvkk,
            CompanyStaffNotificationText = LegalDocumentDefaults.CompanyStaffNotification,
        };

    public void UpdateWebView(bool enabled, string url, string? maxVersion, string? message)
    {
        WebViewEnabled = enabled;
        WebViewUrl = url.Trim();
        WebViewMaxVersion = string.IsNullOrWhiteSpace(maxVersion) ? null : maxVersion.Trim();
        WebViewMessage = string.IsNullOrWhiteSpace(message) ? null : message.Trim();
    }

    public void UpdateVersionControl(
        string? androidMinVersion, string? androidLatestVersion, string? androidStoreUrl,
        string? iosMinVersion, string? iosLatestVersion, string? iosStoreUrl,
        string? updateMessage, string? updateReleaseNotes)
    {
        AndroidMinVersion = Normalize(androidMinVersion);
        AndroidLatestVersion = Normalize(androidLatestVersion);
        AndroidStoreUrl = Normalize(androidStoreUrl);
        IosMinVersion = Normalize(iosMinVersion);
        IosLatestVersion = Normalize(iosLatestVersion);
        IosStoreUrl = Normalize(iosStoreUrl);
        UpdateMessage = Normalize(updateMessage);
        UpdateReleaseNotes = Normalize(updateReleaseNotes);
    }

    public void UpdateSplashImage(string? imageUrl)
        => SplashImageUrl = Normalize(imageUrl);

    public void UpdateHomeLogo(string? imageUrl)
        => HomeLogoUrl = Normalize(imageUrl);

    public void UpdateTabBarLogo(string? imageUrl)
        => TabBarLogoUrl = Normalize(imageUrl);

    public void UpdateOnboardingImages(IEnumerable<string> imageUrls)
        => OnboardingImageUrls = imageUrls
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim())
            .ToList();

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public void UpdateLegalDocuments(
        string citizenKvkk, string citizenNotification,
        string companyKvkk, string companyNotification,
        string companyStaffKvkk, string companyStaffNotification)
    {
        CitizenKvkkText = citizenKvkk.Trim();
        CitizenNotificationText = citizenNotification.Trim();
        CompanyKvkkText = companyKvkk.Trim();
        CompanyNotificationText = companyNotification.Trim();
        CompanyStaffKvkkText = companyStaffKvkk.Trim();
        CompanyStaffNotificationText = companyStaffNotification.Trim();
    }
}
