using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.CompanyStaffAuth.Dtos;

public record CompanyStaffDto(
    Guid Id,
    Guid CompanyId,
    string FullName,
    string Phone,
    string? Email,
    bool IsActive,
    bool CanRedeem,
    bool CanManageCampaigns,
    DateTime? LastLoginAt,
    DateTime CreatedAt,
    bool KvkkAccepted = false,
    bool NotificationConsentAccepted = false);

public record CreateCompanyStaffRequest(string FullName, string Phone, string? Email, string Password, bool CanRedeem = true, bool CanManageCampaigns = false);

public record UpdateCompanyStaffRequest(string FullName, string Phone, string? Email, bool CanRedeem, bool CanManageCampaigns = false);

public record ResetCompanyStaffPasswordResultDto(string NewPassword);

public record SetStaffPasswordRequest(string NewPassword);

public record CompanyStaffLoginRequest(string Phone, string Password);

public record CompanyStaffTokenPairDto(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    CompanyStaffDto Staff,
    CompanyDto Company);

public record CompanyStaffRefreshRequest(string RefreshToken);
