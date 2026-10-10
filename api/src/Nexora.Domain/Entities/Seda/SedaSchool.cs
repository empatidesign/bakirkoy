using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Seda;

public class SedaSchool : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public static SedaSchool Create(string name) => new() { Name = name, IsActive = true };

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
