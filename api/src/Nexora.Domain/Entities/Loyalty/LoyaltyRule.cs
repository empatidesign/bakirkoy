using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Loyalty;

public class LoyaltyRule : BaseEntity
{
    public string ActionKey { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public int Points { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? Description { get; private set; }

    public static LoyaltyRule Create(string actionKey, string label, int points, string? description = null) => new()
    {
        ActionKey = actionKey,
        Label = label,
        Points = points,
        IsActive = true,
        Description = description,
    };

    public void Update(string label, int points, bool isActive, string? description)
    {
        Label = label;
        Points = points;
        IsActive = isActive;
        Description = description;
        UpdatedAt = DateTime.UtcNow;
    }
}
