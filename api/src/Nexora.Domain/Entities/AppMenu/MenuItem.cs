using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.AppMenu;

public class MenuItem : BaseEntity
{
    public Guid SectionId { get; private set; }
    public MenuSection Section { get; private set; } = null!;

    public string? ModuleKey { get; private set; }
    public SystemModule? Module { get; private set; }

    public string Title { get; private set; } = string.Empty;
    public string Icon { get; private set; } = string.Empty;
    public MenuIconType IconType { get; private set; }
    public string Color { get; private set; } = "#1486C9";

    public MenuLinkType LinkType { get; private set; }
    public string LinkTarget { get; private set; } = string.Empty;

    public string? MobileLinkTarget { get; private set; }

    public bool ShowInSidebar { get; private set; } = true;
    public bool ShowInMobile { get; private set; } = true;

    public bool IsPopular { get; private set; }
    public bool IsVisible { get; private set; } = true;
    public bool RequiresAuth { get; private set; } = true;
    public string? BadgeText { get; private set; }
    public string? BadgeTone { get; private set; }

    public int Order { get; private set; }

    public static MenuItem Create(
        Guid sectionId, string? moduleKey,
        string title, string icon, MenuIconType iconType, string color,
        MenuLinkType linkType, string linkTarget, string? mobileLinkTarget,
        bool showInSidebar, bool showInMobile,
        bool isPopular, bool isVisible, bool requiresAuth,
        string? badgeText, string? badgeTone, int order)
        => new()
        {
            SectionId = sectionId,
            ModuleKey = string.IsNullOrWhiteSpace(moduleKey) ? null : moduleKey.Trim(),
            Title = title.Trim(),
            Icon = icon.Trim(),
            IconType = iconType,
            Color = color.Trim(),
            LinkType = linkType,
            LinkTarget = linkTarget.Trim(),
            MobileLinkTarget = string.IsNullOrWhiteSpace(mobileLinkTarget) ? null : mobileLinkTarget.Trim(),
            ShowInSidebar = showInSidebar,
            ShowInMobile = showInMobile,
            IsPopular = isPopular,
            IsVisible = isVisible,
            RequiresAuth = requiresAuth,
            BadgeText = string.IsNullOrWhiteSpace(badgeText) ? null : badgeText.Trim(),
            BadgeTone = string.IsNullOrWhiteSpace(badgeTone) ? null : badgeTone.Trim(),
            Order = order,
        };

    public void Update(
        Guid sectionId, string? moduleKey,
        string title, string icon, MenuIconType iconType, string color,
        MenuLinkType linkType, string linkTarget, string? mobileLinkTarget,
        bool showInSidebar, bool showInMobile,
        bool isPopular, bool isVisible, bool requiresAuth,
        string? badgeText, string? badgeTone)
    {
        SectionId = sectionId;
        ModuleKey = string.IsNullOrWhiteSpace(moduleKey) ? null : moduleKey.Trim();
        Title = title.Trim();
        Icon = icon.Trim();
        IconType = iconType;
        Color = color.Trim();
        LinkType = linkType;
        LinkTarget = linkTarget.Trim();
        MobileLinkTarget = string.IsNullOrWhiteSpace(mobileLinkTarget) ? null : mobileLinkTarget.Trim();
        ShowInSidebar = showInSidebar;
        ShowInMobile = showInMobile;
        IsPopular = isPopular;
        IsVisible = isVisible;
        RequiresAuth = requiresAuth;
        BadgeText = string.IsNullOrWhiteSpace(badgeText) ? null : badgeText.Trim();
        BadgeTone = string.IsNullOrWhiteSpace(badgeTone) ? null : badgeTone.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetOrder(int order)
    {
        Order = order;
        UpdatedAt = DateTime.UtcNow;
    }
}
