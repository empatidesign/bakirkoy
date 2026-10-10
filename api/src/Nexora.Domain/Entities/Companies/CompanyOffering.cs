using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Companies;

// IDN-İşletme (2026-09-11): mobil BusinessServiceFormScreen'in CRUD yaptığı
// "hizmet kataloğu" kavramı — bir işletmenin sunduğu hizmetler (ör. "Saç
// Kesimi", 100-250 TL, 30-60 dk). Campaign (indirim/kampanya) kavramından
// AYRIDIR; ismi CompanyOffering (Company/Nexora.Application.Features.*'taki
// var olan IXxxService pattern'iyle karışmasın diye).
public class CompanyOffering : BaseEntity
{
    public Guid CompanyId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public decimal MinPrice { get; private set; }
    public decimal MaxPrice { get; private set; }
    public int MinDurationMinutes { get; private set; }
    public int MaxDurationMinutes { get; private set; }
    public string? ImageUrl { get; private set; }
    public bool IsPopular { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static CompanyOffering Create(
        Guid companyId, string name, string? description, string category,
        decimal minPrice, decimal maxPrice, int minDurationMinutes, int maxDurationMinutes,
        string? imageUrl, bool isPopular)
    {
        return new CompanyOffering
        {
            CompanyId = companyId,
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Category = category.Trim(),
            MinPrice = minPrice,
            MaxPrice = maxPrice,
            MinDurationMinutes = minDurationMinutes,
            MaxDurationMinutes = maxDurationMinutes,
            ImageUrl = imageUrl,
            IsPopular = isPopular,
        };
    }

    public void Update(
        string name, string? description, string category,
        decimal minPrice, decimal maxPrice, int minDurationMinutes, int maxDurationMinutes,
        string? imageUrl, bool isPopular, bool isActive)
    {
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Category = category.Trim();
        MinPrice = minPrice;
        MaxPrice = maxPrice;
        MinDurationMinutes = minDurationMinutes;
        MaxDurationMinutes = maxDurationMinutes;
        ImageUrl = imageUrl;
        IsPopular = isPopular;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }
}
