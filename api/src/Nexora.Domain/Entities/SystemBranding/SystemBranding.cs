using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.SystemBranding;

public class SystemBranding : BaseEntity
{
    public static readonly Guid SingletonId = new("00000000-0000-0000-0000-00000000b4a1");

    public string? LogoUrl { get; private set; }
    public string? LogoObjectName { get; private set; }
    public string? HorizontalLogoUrl { get; private set; }
    public string? HorizontalLogoObjectName { get; private set; }

    public static SystemBranding CreateDefault() => new() { Id = SingletonId };

    public void SetLogo(string url, string objectName)
    {
        LogoUrl = url.Trim();
        LogoObjectName = objectName.Trim();
    }

    public void ClearLogo()
    {
        LogoUrl = null;
        LogoObjectName = null;
    }

    public void SetHorizontalLogo(string url, string objectName)
    {
        HorizontalLogoUrl = url.Trim();
        HorizontalLogoObjectName = objectName.Trim();
    }

    public void ClearHorizontalLogo()
    {
        HorizontalLogoUrl = null;
        HorizontalLogoObjectName = null;
    }
}
