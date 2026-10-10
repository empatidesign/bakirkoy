using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Companies;

public class ServiceCategory : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Color { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public List<Company> Companies { get; private set; } = [];

    public static ServiceCategory Create(string name, string? description, string color)
        => new()
        {
            Name = name.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Color = color.Trim(),
        };

    public void Update(string name, string? description, string color)
    {
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Color = color.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
