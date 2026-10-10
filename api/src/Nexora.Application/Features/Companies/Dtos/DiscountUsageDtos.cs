namespace Nexora.Application.Features.Companies.Dtos;

public record DiscountUsageDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    Guid CampaignId,
    string CampaignName,
    Guid UserId,
    string UserName,
    string? UserPhone,
    string DiscountCode,
    decimal? OrderAmount,
    DateTime UsedAt,
    DateTime? QrScannedAt,
    string Status,
    DateTime? CancelledAt,
    string? CancelReason);

public record CancelUsageRequest(string? Reason);

public record DiscountUsageSummaryDto(int Total, int Used, int UniqueUsers);

public record DiscountUsageListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CompanyId { get; init; }
    public Guid? CampaignId { get; init; }
    public string? Status { get; init; }
    public string? DateRange { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CompanyCampaignUsageDto(
    Guid Id,
    Guid CampaignId,
    string CampaignName,
    string MaskedUserName,
    string MaskedUserPhone,
    DateTime UsedAt,
    string Status);

public record CompanyCampaignUsageListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public Guid? CampaignId { get; init; }
    public string? DateRange { get; init; }
}

