using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Auth;

public class Permission : BaseEntity
{
    public string ModuleKey { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string Key { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; } = true;

    public static Permission Create(string moduleKey, string action, string name)
    {
        var mk = moduleKey.Trim();
        var act = action.Trim();
        return new()
        {
            ModuleKey = mk,
            Action = act,
            Key = $"{mk}.{act}",
            Name = name.Trim(),
        };
    }

    public void Rename(string name) => Name = name.Trim();
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}

public class RolePermission : BaseEntity
{
    public Guid RoleId { get; private set; }
    public Guid PermissionId { get; private set; }

    public static RolePermission Create(Guid roleId, Guid permissionId)
        => new() { RoleId = roleId, PermissionId = permissionId };
}
