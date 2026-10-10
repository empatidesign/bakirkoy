using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Loyalty;

public class Reward : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public int PointsRequired { get; private set; }
    public string? ImageUrl { get; private set; }
    public int Stock { get; private set; }
    public bool IsActive { get; private set; } = true;
    public int TotalRedeemed { get; private set; }

    public static Reward Create(string name, int pointsRequired, int stock, string? description = null, string? imageUrl = null) => new()
    {
        Name = name,
        PointsRequired = pointsRequired,
        Stock = stock,
        Description = description,
        ImageUrl = imageUrl,
        IsActive = true,
        TotalRedeemed = 0,
    };

    public void Update(string name, int pointsRequired, int stock, bool isActive, string? description, string? imageUrl)
    {
        Name = name;
        PointsRequired = pointsRequired;
        Stock = stock;
        IsActive = isActive;
        Description = description;
        ImageUrl = imageUrl;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool TryRedeem()
    {
        if (!IsActive || Stock <= 0) return false;
        Stock--;
        TotalRedeemed++;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public void RestoreStockAfterCancel()
    {
        Stock++;
        TotalRedeemed = Math.Max(0, TotalRedeemed - 1);
        UpdatedAt = DateTime.UtcNow;
    }
}
