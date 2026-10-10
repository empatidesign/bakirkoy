using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Auth;

public class Role : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string Key { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;
    public bool IsSuperAdmin { get; private set; }
    public string Color { get; private set; } = string.Empty;

    public static Role Create(string name, string key, string? description)
        => new()
        {
            Name = name.Trim(),
            Key = key.Trim(),
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
        };

    public void SetColor(string color) => Color = color.Trim();

    public void SetIsSuperAdmin(bool v) => IsSuperAdmin = v;

    public void Update(string name, string? description)
    {
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
