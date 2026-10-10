namespace Nexora.Application.Features.Companies.Dtos;

public record CampaignProductDto(
    Guid Id,
    string Name,
    string? ImageUrl,
    decimal? Price,
    int SortOrder);

public record CampaignProductInput(
    Guid? Id,
    string Name,
    string? ImageUrl,
    decimal? Price,
    int SortOrder);

public record CampaignDto(
    Guid Id,
    Guid CompanyId,
    string CompanyName,
    string Name,
    string DiscountType,
    decimal DiscountValue,
    int PerUserLimit,
    int? TotalUsageLimit,
    decimal? MinOrderAmount,
    DateTime StartDate,
    DateTime EndDate,
    int UsageCount,
    string Status,
    string Category,
    bool IsRedeemable,
    bool IsExhausted,
    ServiceCategoryRefDto? ServiceCategory,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string? ImageUrl,
    string? Description,
    string? Rules,
    string? KvkkText,
    IReadOnlyList<CampaignProductDto> Products);

public record CampaignSummaryDto(int Total, int Active, int Completed, int Passive, int TotalUsages);

public record RedeemByQrRequest(string Token, decimal? OrderAmount = null);

public record RedeemManualRequest(string? Tckn, string? Phone, decimal? OrderAmount = null);

public record CampaignRedeemResultDto(
    Guid CampaignId,
    string CampaignName,
    string CompanyName,
    string ParticipantName,
    string DiscountType,
    decimal DiscountValue,
    int PerUserLimit,
    int UsedCount,
    int RemainingUses);

public record CampaignOptionDto(string Value, string Label);

public record CreateCampaignRequest(
    Guid CompanyId,
    string Name,
    string DiscountType,
    decimal DiscountValue,
    int PerUserLimit,
    int? TotalUsageLimit,
    decimal? MinOrderAmount,
    DateTime StartDate,
    DateTime EndDate,
    string? Category,
    string? ImageUrl,
    string? Description,
    string? Rules,
    string? KvkkText,
    List<CampaignProductInput>? Products);

public record CreateMyCampaignRequest(
    string Name,
    string DiscountType,
    decimal DiscountValue,
    int PerUserLimit,
    int? TotalUsageLimit,
    decimal? MinOrderAmount,
    DateTime StartDate,
    DateTime EndDate,
    string? Category,
    string? ImageUrl,
    string? Description,
    string? Rules,
    string? KvkkText,
    List<CampaignProductInput>? Products);

public record UpdateCampaignRequest(
    string Name,
    string DiscountType,
    decimal DiscountValue,
    int PerUserLimit,
    int? TotalUsageLimit,
    decimal? MinOrderAmount,
    DateTime StartDate,
    DateTime EndDate,
    string? Category,
    string? ImageUrl,
    string? Description,
    string? Rules,
    string? KvkkText,
    List<CampaignProductInput>? Products);

public record CampaignListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? CompanyId { get; init; }
    public string? Status { get; init; }
    public string? Category { get; init; }
    public string? DateRange { get; init; }
    public Guid? ServiceCategoryId { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }

    public DateTime? CreatedFrom { get; init; }
    public DateTime? CreatedTo { get; init; }
}

// IDN-İşletme (2026-09-11): mobil BusinessValidateScreen'in iki adımlı akışı
// (önce ara/göster, sonra doğrula/kullandır) için eklendi. Backend'de ayrı bir
// "katılım" (join/personalCode) kavramı yok — vatandaş doğrudan RedeemManualAsync
// ile kullanır. Bu iki uç o akışı sarmalar: Search salt-okunur bir önizlemedir
// (kayıt oluşturmaz), Validate gerçek RedeemManualAsync'i çağırıp kullanım kaydı
// oluşturur.
public record SearchParticipantRequest(string? Tckn, string? Phone);

public record ParticipantPreviewDto(
    Guid ParticipationId,
    string ParticipantName,
    string? ParticipantPhone,
    string? ParticipantTc,
    string CampaignName,
    string Status);
