using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Seda;

public class SedaDefinition : BaseEntity
{
    public string Type { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public static SedaDefinition Create(string type, string name) => new() { Type = type, Name = name, IsActive = true };

    public void Update(string name)
    {
        Name = name;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }
}
