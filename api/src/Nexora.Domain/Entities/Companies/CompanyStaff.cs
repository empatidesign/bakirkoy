using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Companies;

public class CompanyStaff : BaseEntity
{
    public Guid CompanyId { get; private set; }
    public string FullName { get; private set; } = "";
    public string Phone { get; private set; } = "";
    public string? Email { get; private set; }
    public string PasswordHash { get; private set; } = "";
    public bool IsActive { get; private set; } = true;
    public bool CanRedeem { get; private set; } = true;

    public bool CanManageCampaigns { get; private set; }

    public DateTime? LastLoginAt { get; private set; }

    // 2026-07-30 denetiminde eklendi: firma personeli girişinde hesap bazlı
    // brute-force kilidi hiç yoktu. AdminUser'daki aynı desen: 5 yanlış
    // denemede 15 dakika kilit.
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

    public Company Company { get; private set; } = default!;

    private CompanyStaff() { }

    public static CompanyStaff Create(Guid companyId, string fullName, string phone, string? email, string passwordHash)
        => new()
        {
            CompanyId = companyId,
            FullName = fullName.Trim(),
            Phone = phone.Trim(),
            Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant(),
            PasswordHash = passwordHash,
            IsActive = true,
            CanRedeem = true,
        };

    public void UpdateInfo(string fullName, string phone, string? email)
    {
        FullName = fullName.Trim();
        Phone = phone.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
    }

    public void SetPasswordHash(string hash) => PasswordHash = hash;

    public void CompletePasswordChange(string hash)
    {
        PasswordHash = hash;
        FailedLoginCount = 0;
        LockedUntil = null;
        SecurityVersion++;
    }
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
    public void SetCanRedeem(bool value) => CanRedeem = value;
    public void SetCanManageCampaigns(bool value) => CanManageCampaigns = value;
    public void RecordLogin()
    {
        LastLoginAt = DateTime.UtcNow;
        FailedLoginCount = 0;
        LockedUntil = null;
    }
}
