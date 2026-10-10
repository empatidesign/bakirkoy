using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.AppMenu;

public class TopMenuItem : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string Icon { get; private set; } = string.Empty;
    public MenuIconType IconType { get; private set; }
    public string Color { get; private set; } = "#1486C9";

    public TopMenuLinkType LinkType { get; private set; }
    public string LinkTarget { get; private set; } = string.Empty;
    public bool OpenInBlank { get; private set; }

    public bool IsVisible { get; private set; } = true;
    public int Order { get; private set; }

    private TopMenuItem() { }

    public static TopMenuItem Create(string title, string icon, MenuIconType iconType, string color,
        TopMenuLinkType linkType, string linkTarget, bool openInBlank, int order)
    {
        return new TopMenuItem
        {
            Title = title,
            Icon = icon,
            IconType = iconType,
            Color = color,
            LinkType = linkType,
            LinkTarget = linkTarget,
            OpenInBlank = openInBlank,
            IsVisible = true,
            Order = order,
        };
    }

    public void Update(string title, string icon, MenuIconType iconType, string color,
        TopMenuLinkType linkType, string linkTarget, bool openInBlank, bool isVisible, int order)
    {
        Title = title;
        Icon = icon;
        IconType = iconType;
        Color = color;
        LinkType = linkType;
        LinkTarget = linkTarget;
        OpenInBlank = openInBlank;
        IsVisible = isVisible;
        Order = order;
        UpdatedAt = DateTime.UtcNow;
    }
}
