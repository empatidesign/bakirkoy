using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Events;

public class EventCategory : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Color { get; private set; } = string.Empty;
    public int DefaultPoints { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static EventCategory Create(string name, string? description, string color, int defaultPoints)
        => new()
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Color = color.Trim(),
            DefaultPoints = defaultPoints < 0 ? 0 : defaultPoints,
        };

    public void Update(string name, string? description, string color, int defaultPoints)
    {
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Color = color.Trim();
        DefaultPoints = defaultPoints < 0 ? 0 : defaultPoints;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
    }
}
