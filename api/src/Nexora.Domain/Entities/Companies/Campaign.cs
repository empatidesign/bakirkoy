using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Companies;

public class Campaign : BaseEntity
{
    public Guid CompanyId { get; private set; }
    public Company? Company { get; private set; }
    public string Name { get; private set; } = "";
    public DiscountType DiscountType { get; private set; }
    public decimal DiscountValue { get; private set; }
    public int PerUserLimit { get; private set; }
    public int? TotalUsageLimit { get; private set; }
    public decimal? MinOrderAmount { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public int UsageCount { get; private set; }
    public CampaignStatus Status { get; private set; }

    public CampaignCategory Category { get; private set; } = CampaignCategory.Other;

    public string? ImageUrl { get; private set; }
    public string? Description { get; private set; }
    public string? Rules { get; private set; }
    public string? KvkkText { get; private set; }

    public ICollection<CampaignProduct> Products { get; private set; } = [];

    public void SetImageUrl(string? url) => ImageUrl = url;
    public void SetDescription(string? description) => Description = description?.Trim();

    public static Campaign Create(Guid companyId, string name, DiscountType discountType, decimal discountValue,
        int perUserLimit, int? totalUsageLimit, decimal? minOrderAmount, DateTime startDate, DateTime endDate,
        CampaignCategory category = CampaignCategory.Other,
        string? imageUrl = null, string? description = null, string? rules = null, string? kvkkText = null)
        => new()
        {
            CompanyId = companyId,
            Name = name.Trim(),
            DiscountType = discountType,
            DiscountValue = discountValue,
            PerUserLimit = perUserLimit,
            TotalUsageLimit = totalUsageLimit,
            MinOrderAmount = minOrderAmount,
            StartDate = startDate,
            EndDate = endDate,
            Status = CampaignStatus.Active,
            Category = category,
            ImageUrl = imageUrl,
            Description = description?.Trim(),
            Rules = rules?.Trim(),
            KvkkText = kvkkText?.Trim(),
        };

    public void Update(string name, DiscountType discountType, decimal discountValue, int perUserLimit,
        int? totalUsageLimit, decimal? minOrderAmount, DateTime startDate, DateTime endDate,
        CampaignCategory category = CampaignCategory.Other,
        string? imageUrl = null, string? description = null, string? rules = null, string? kvkkText = null)
    {
        Name = name.Trim();
        DiscountType = discountType;
        DiscountValue = discountValue;
        PerUserLimit = perUserLimit;
        TotalUsageLimit = totalUsageLimit;
        MinOrderAmount = minOrderAmount;
        StartDate = startDate;
        EndDate = endDate;
        Category = category;
        ImageUrl = imageUrl;
        Description = description?.Trim();
        Rules = rules?.Trim();
        KvkkText = kvkkText?.Trim();
    }

    public void SyncProducts(IEnumerable<(Guid? Id, string Name, string? ImageUrl, decimal? Price, int SortOrder)> items)
    {
        var incoming = items.ToList();
        var incomingIds = incoming.Where(i => i.Id.HasValue).Select(i => i.Id!.Value).ToHashSet();

        foreach (var existing in Products.Where(p => !incomingIds.Contains(p.Id)).ToList())
            Products.Remove(existing);

        foreach (var item in incoming)
        {
            var match = item.Id.HasValue ? Products.FirstOrDefault(p => p.Id == item.Id.Value) : null;
            if (match is not null)
                match.Update(item.Name, item.ImageUrl, item.Price, item.SortOrder);
            else
                Products.Add(CampaignProduct.Create(Id, item.Name, item.ImageUrl, item.Price, item.SortOrder));
        }
    }

    public void SetStatus(CampaignStatus status) => Status = status;
    public void IncrementUsage() => UsageCount++;
    public void DecrementUsage() => UsageCount = Math.Max(0, UsageCount - 1);

    public bool IsRedeemableOn(DateTime today) => Status == CampaignStatus.Active
        && StartDate.Date <= today
        && EndDate.Date >= today
        && (!TotalUsageLimit.HasValue || UsageCount < TotalUsageLimit.Value);

    public bool IsRedeemable => IsRedeemableOn(TurkeyTime.TodayDate());
}
