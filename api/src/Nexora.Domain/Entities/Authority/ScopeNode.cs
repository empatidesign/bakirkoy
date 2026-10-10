using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Authority;

public class ScopeNode : BaseEntity
{
    public string Type { get; private set; } = string.Empty;
    public string RefModuleKey { get; private set; } = string.Empty;
    public Guid RefId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public static ScopeNode Create(string type, string refModuleKey, Guid refId, string name)
        => new()
        {
            Type = type.Trim(),
            RefModuleKey = refModuleKey.Trim(),
            RefId = refId,
            Name = name.Trim(),
            IsActive = true,
        };

    public void Rename(string name) => Name = name.Trim();
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
