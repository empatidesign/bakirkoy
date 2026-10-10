namespace Nexora.Application.Features.Companies.Dtos;

public record CompanySocialMediaDto(
    string? Facebook,
    string? Instagram,
    string? Twitter,
    string? Linkedin);

public record CompanyDto(
    Guid Id,
    string Name,
    string TaxNumber,
    string Phone,
    string? Email,
    string Address,
    string District,
    string Status,
    bool EmailVerified,
    bool PhoneVerified,
    string? Logo,
    string? BannerImage,
    string? BannerImageMobile,
    string? Description,
    string? Website,
    CompanySocialMediaDto? SocialMedia,
    double? Latitude,
    double? Longitude,
    string? RejectReason,
    ServiceCategoryRefDto? ServiceCategory,
    int TotalCampaigns,
    int TotalUsages,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<string>? GalleryImages,
    string? ServiceDescription,
    bool KvkkAccepted = false,
    bool NotificationConsentAccepted = false,
    string? GooglePlaceId = null,
    bool IsLocked = false,
    DateTime? LockedUntil = null);

public record CompanySummaryDto(int Total, int Pending, int Approved, int Rejected, int Passive);

public record CompanyOptionDto(string Value, string Label);

public record CompanyTopItemDto(Guid Id, string Name, int Count);

public record CompanyDashboardDto(
    int TotalCompanies,
    int PendingCompanies,
    int ApprovedCompanies,
    int ActiveCampaigns,
    int TotalUsages,
    int MonthlyUsages,
    int PreviousMonthlyUsages,
    CompanyStatusDistributionDto StatusDistribution,
    List<CompanyTopItemDto> TopByCampaigns,
    List<CompanyTopItemDto> TopByUsages);

public record CompanyStatusDistributionDto(int Approved, int Pending, int Rejected, int Passive);

public record CreateCompanyRequest(
    string Name,
    string TaxNumber,
    string Phone,
    string? Email,
    string Address,
    string? District,
    string? Logo,
    string? BannerImage,
    string? BannerImageMobile,
    string? Description,
    string? Website,
    CompanySocialMediaDto? SocialMedia,
    double? Latitude,
    double? Longitude,
    Guid? ServiceCategoryId,
    string? DeliveryChannel,
    List<string>? GalleryImages,
    string? ServiceDescription);

public record UpdateCompanyRequest(
    string Name,
    string Phone,
    string? Email,
    string Address,
    string? District,
    string? Logo,
    string? BannerImage,
    string? BannerImageMobile,
    string? Description,
    string? Website,
    CompanySocialMediaDto? SocialMedia,
    double? Latitude,
    double? Longitude,
    Guid? ServiceCategoryId,
    List<string>? GalleryImages,
    string? ServiceDescription);

public record RejectCompanyRequest(string? Reason);

public record CompanySendPasswordResetRequest(string Channel);

public record CompanySetManualPasswordRequest(string NewPassword, bool MustChangeOnFirstLogin);

public record CompanyImportRowResultDto(int Row, string Name, string Outcome, string? Reason, string? AssignedCategory);

public record CompanyImportResultDto(
    int TotalRows,
    int Added,
    int Skipped,
    int FailedRows,
    List<CompanyImportRowResultDto> Rows);

public record CompanyListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public Guid? ServiceCategoryId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
