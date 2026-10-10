using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Companies;

public class CampaignProduct : BaseEntity
{
    public Guid CampaignId { get; private set; }
    public Campaign? Campaign { get; private set; }
    public string Name { get; private set; } = "";
    public string? ImageUrl { get; private set; }
    public decimal? Price { get; private set; }
    public int SortOrder { get; private set; }

    public static CampaignProduct Create(Guid campaignId, string name, string? imageUrl, decimal? price, int sortOrder)
        => new()
        {
            CampaignId = campaignId,
            Name = name.Trim(),
            ImageUrl = imageUrl,
            Price = price,
            SortOrder = sortOrder,
        };

    public void Update(string name, string? imageUrl, decimal? price, int sortOrder)
    {
        Name = name.Trim();
        ImageUrl = imageUrl;
        Price = price;
        SortOrder = sortOrder;
    }
}
