using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public class TravelCategory : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public static TravelCategory Create(string name, string description, string color)
        => new()
        {
            Name = name.Trim(),
            Description = description?.Trim() ?? string.Empty,
            Color = color.Trim(),
        };

    public void Update(string name, string description, string color)
    {
        Name = name.Trim();
        Description = description?.Trim() ?? string.Empty;
        Color = color.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
