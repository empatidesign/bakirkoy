using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Auth;

public class PermissionModule : BaseEntity
{
    public string Key { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Group { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }
    public bool Scopable { get; private set; }
    public bool IsActive { get; private set; } = true;

    public static PermissionModule Create(string key, string name, string group, int displayOrder, bool scopable)
        => new()
        {
            Key = key.Trim(),
            Name = name.Trim(),
            Group = group.Trim(),
            DisplayOrder = displayOrder,
            Scopable = scopable,
        };

    public void Update(string name, string group, int displayOrder, bool scopable)
    {
        Name = name.Trim();
        Group = group.Trim();
        DisplayOrder = displayOrder;
        Scopable = scopable;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
