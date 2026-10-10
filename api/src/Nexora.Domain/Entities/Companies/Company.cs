using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Companies;

public class CompanySocialMedia
{
    public string? Facebook { get; set; }
    public string? Instagram { get; set; }
    public string? Twitter { get; set; }
    public string? Linkedin { get; set; }
}

public class Company : BaseEntity
{
    public string Name { get; private set; } = "";
    public string TaxNumber { get; private set; } = "";
    public string Phone { get; private set; } = "";
    public string? Email { get; private set; }
    public string Address { get; private set; } = "";
    public string District { get; private set; } = "";
    public string PasswordHash { get; private set; } = "";
    public string? Logo { get; private set; }
    public string? BannerImage { get; private set; }
    public string? BannerImageMobile { get; private set; }
    public string? Description { get; private set; }
    public string? Website { get; private set; }
    public CompanySocialMedia? SocialMedia { get; private set; }
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public string? GooglePlaceId { get; private set; }
    public CompanyStatus Status { get; private set; }
    public bool IsFirstLogin { get; private set; }
    public bool EmailVerified { get; private set; }
    public bool PhoneVerified { get; private set; }
    public string? RejectReason { get; private set; }
    public DateTime? ApprovedAt { get; private set; }
    public string? ApprovedByName { get; private set; }
    public List<string> GalleryImages { get; private set; } = [];
    public string? ServiceDescription { get; private set; }

    // 2026-07-30 denetiminde eklendi: firma girişinde hesap bazlı brute-force
    // kilidi hiç yoktu. AdminUser'daki aynı desen: 5 yanlış denemede 15 dakika kilit.
    public int FailedLoginCount { get; private set; }
    public DateTime? LockedUntil { get; private set; }

    public bool IsLocked => LockedUntil.HasValue && LockedUntil.Value > DateTime.UtcNow;

    public int SecurityVersion { get; private set; }

    public void BumpSecurityVersion() => SecurityVersion++;

    // Kullanıcı isteği (2026-09-21): kilit süresi botlar tarafından tahmin
    // edilemesin diye jitterSeconds servis katmanında rastgele üretilip eklenir
    // (bkz. AdminUser.RecordFailedLogin).
    public void RecordFailedLogin(int threshold, int lockoutMinutes, int jitterSeconds = 0)
    {
        FailedLoginCount++;
        if (FailedLoginCount >= threshold)
            LockedUntil = DateTime.UtcNow.AddMinutes(lockoutMinutes).AddSeconds(jitterSeconds);
    }

    public void RecordSuccessfulLogin()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    public void Unlock()
    {
        FailedLoginCount = 0;
        LockedUntil = null;
    }

    // Kullanıcı isteği: KVKK/sözleşme onayı ile bildirim izni onayı.
    public DateTime? KvkkAcceptedAt { get; private set; }
    public DateTime? NotificationConsentAcceptedAt { get; private set; }

    public bool AcceptKvkk()
    {
        if (KvkkAcceptedAt.HasValue) return false;
        KvkkAcceptedAt = DateTime.UtcNow;
        return true;
    }

    public bool AcceptNotificationConsent()
    {
        if (NotificationConsentAcceptedAt.HasValue) return false;
        NotificationConsentAcceptedAt = DateTime.UtcNow;
        return true;
    }

    public List<Campaign> Campaigns { get; private set; } = [];
    public Guid? ServiceCategoryId { get; private set; }
    public ServiceCategory? ServiceCategory { get; private set; }

    public void SetServiceCategory(Guid? id) => ServiceCategoryId = id;

    public void RequireInitialPasswordChange() => IsFirstLogin = true;

    public void CompleteInitialPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        IsFirstLogin = false;
        FailedLoginCount = 0;
        LockedUntil = null;
        SecurityVersion++;
    }

    public static Company Create(string name, string taxNumber, string phone, string? email, string address, string district, string passwordHash)
        => new()
        {
            Name = TextCasing.CapitalizeFirstLetters(name.Trim()),
            TaxNumber = taxNumber.Trim(),
            Phone = phone.Trim(),
            Email = Normalize(email)?.ToLowerInvariant(),
            Address = address.Trim(),
            District = string.IsNullOrWhiteSpace(district) ? "Sultangazi" : district.Trim(),
            PasswordHash = passwordHash,
            Status = CompanyStatus.Pending,
        };

    public void UpdateProfile(string name, string phone, string? email, string address, string district,
        string? logo, string? bannerImage, string? description, string? website, CompanySocialMedia? socialMedia,
        double? latitude, double? longitude, List<string>? galleryImages = null, string? serviceDescription = null,
        string? bannerImageMobile = null)
    {
        Name = TextCasing.CapitalizeFirstLetters(name.Trim());
        Phone = phone.Trim();
        Email = Normalize(email)?.ToLowerInvariant();
        Address = address.Trim();
        District = string.IsNullOrWhiteSpace(district) ? District : district.Trim();
        Logo = Normalize(logo);
        BannerImage = Normalize(bannerImage);
        BannerImageMobile = Normalize(bannerImageMobile);
        Description = Normalize(description);
        Website = Normalize(website);
        SocialMedia = socialMedia;
        Latitude = latitude;
        Longitude = longitude;
        GalleryImages = galleryImages ?? GalleryImages;
        ServiceDescription = Normalize(serviceDescription);
    }

    public void SetVerifiedLocation(string standardizedAddress, double latitude, double longitude, string? placeId)
    {
        Address = standardizedAddress.Trim();
        Latitude = latitude;
        Longitude = longitude;
        GooglePlaceId = Normalize(placeId);
    }

    public void Approve(string? approvedByName)
    {
        Status = CompanyStatus.Approved;
        RejectReason = null;
        ApprovedAt = DateTime.UtcNow;
        ApprovedByName = approvedByName;
    }

    public void Reject(string? reason)
    {
        Status = CompanyStatus.Rejected;
        RejectReason = Normalize(reason);
    }

    public void RevertApproval()
    {
        Status = CompanyStatus.Pending;
        ApprovedAt = null;
        ApprovedByName = null;
        RejectReason = null;
    }

    public void SetStatus(CompanyStatus status) => Status = status;
    public void SetPasswordHash(string passwordHash) => PasswordHash = passwordHash;

    public void ResetTemporaryPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        IsFirstLogin = true;
    }

    public void MarkEmailVerified() => EmailVerified = true;
    public void MarkPhoneVerified() => PhoneVerified = true;

    public bool IsApproved => Status == CompanyStatus.Approved;

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
