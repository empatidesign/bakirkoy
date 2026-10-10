namespace Nexora.Application.Common.Interfaces;

public interface ICurrentUser
{
    Guid? Id { get; }
    string? Name { get; }
    string? Email { get; }
    string? Role { get; }
    bool IsSuperAdmin { get; }
    bool MustChangePassword { get; }
    string? UserType { get; }
    /// <summary>
    /// Kullanıcı isteği (2026-10-04): mobil uygulamada kaç iOS/Android kullanıcısının
    /// online olduğunu takip edebilmek için istemcinin gönderdiği X-Client-Platform
    /// header'ı (citizen-portal: Capacitor.getPlatform() → "ios"/"android"/"web").
    /// </summary>
    string? Platform { get; }
    string? IpAddress { get; }
    string? ConnectionIpAddress { get; }
    string? UserAgent { get; }
    string? SessionId { get; }
    bool IsAuthenticated { get; }
    Guid? CompanyStaffCompanyId { get; }
    bool CanRedeem { get; }

    bool CanManageCampaigns { get; }
}
