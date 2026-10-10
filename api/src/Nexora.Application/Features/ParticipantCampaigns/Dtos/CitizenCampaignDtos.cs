using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.ParticipantCampaigns.Dtos;

public record CitizenCampaignDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string? CompanyLogo,
    string Name,
    string DiscountType,
    decimal DiscountValue,
    int PerUserLimit,
    int? TotalUsageLimit,
    int MyUsageCount,
    decimal? MinOrderAmount,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    bool IsExhausted,
    ServiceCategoryRefDto? ServiceCategory,
    DateTime CreatedAt,
    string? ImageUrl,
    string? Description,
    string Category,
    IReadOnlyList<CampaignProductDto> Products,
    bool IsSaved = false,
    bool IsNew = false,
    double? CompanyLatitude = null,
    double? CompanyLongitude = null,
    double? DistanceKm = null);

public record CitizenCampaignListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public List<Guid>? CategoryIds { get; init; }
    public string? DateStatus { get; init; }
    public bool OnlySaved { get; init; }
    public Guid? CompanyId { get; init; }

    public bool OnlyNew { get; init; }
    public string? SortBy { get; init; }

    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
}

public record CitizenCampaignCompanyDto(
    Guid Id,
    string Name,
    string? Logo,
    string? Description,
    string? Address,
    string? Phone,
    ServiceCategoryRefDto? ServiceCategory,
    int ActiveCampaignCount);

public record CitizenDirectoryCompanyDto(
    Guid Id,
    string Name,
    string? Logo,
    string? BannerImage,
    string? BannerImageMobile,
    string? Description,
    string? ServiceDescription,
    string Address,
    string District,
    string? Phone,
    string? Website,
    double? Latitude,
    double? Longitude,
    List<string> GalleryImages,
    ServiceCategoryRefDto? ServiceCategory,
    int ActiveCampaignCount,
    CompanySocialMediaDto? SocialMedia,
    double? DistanceKm,
    string? GooglePlaceId = null)
{
    public string? CategoryName => ServiceCategory?.Name;
}

public record CitizenDirectoryCompanyListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public List<Guid>? CategoryIds { get; init; }
    public string? District { get; init; }
    public bool OnlyWithCampaigns { get; init; }
    public bool OnlyWithLocation { get; init; }

    public double? Latitude { get; init; }
    public double? Longitude { get; init; }
    public string? Sort { get; init; }
}

public record CitizenCampaignRedeemDto(
    Guid CampaignId,
    string CampaignName,
    string CompanyName,
    string Token,
    int RotationSeconds,
    int PerUserLimit,
    int RemainingUses);

public record CitizenCampaignUsageDto(
    Guid UsageId,
    Guid CampaignId,
    string CampaignName,
    string CompanyName,
    string? CompanyLogo,
    string DiscountType,
    decimal DiscountValue,
    DateTime UsedAt);

public record CampaignSettingsDto(int LastDayThresholdDays);
