using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.MobileMenu;

public class MobileMenuItem : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string Icon { get; private set; } = string.Empty;
    public MenuIconType IconType { get; private set; }
    public string Color { get; private set; } = "#1486C9";
    public string? ColorSecondary { get; private set; }
    public string? Description { get; private set; }
    public MenuLinkType LinkType { get; private set; }
    public string LinkTarget { get; private set; } = string.Empty;
    public string GroupKey { get; private set; } = string.Empty;
    public string GroupTitle { get; private set; } = string.Empty;
    public bool IsPopular { get; private set; }
    public bool IsVisible { get; private set; } = true;
    public bool RequiresAuth { get; private set; }
    public int Order { get; private set; }

    public static MobileMenuItem Create(
        string title, string icon, MenuIconType iconType, string color,
        string? colorSecondary, string? description,
        MenuLinkType linkType, string linkTarget,
        string groupKey, string groupTitle,
        bool isPopular, bool isVisible, bool requiresAuth, int order)
        => new()
        {
            Title = title.Trim(),
            Icon = icon.Trim(),
            IconType = iconType,
            Color = color.Trim(),
            ColorSecondary = Normalize(colorSecondary),
            Description = Normalize(description),
            LinkType = linkType,
            LinkTarget = linkTarget.Trim(),
            GroupKey = groupKey.Trim(),
            GroupTitle = groupTitle.Trim(),
            IsPopular = isPopular,
            IsVisible = isVisible,
            RequiresAuth = requiresAuth,
            Order = order,
        };

    public void Update(
        string title, string icon, MenuIconType iconType, string color,
        string? colorSecondary, string? description,
        MenuLinkType linkType, string linkTarget,
        string groupKey, string groupTitle,
        bool isPopular, bool isVisible, bool requiresAuth)
    {
        Title = title.Trim();
        Icon = icon.Trim();
        IconType = iconType;
        Color = color.Trim();
        ColorSecondary = Normalize(colorSecondary);
        Description = Normalize(description);
        LinkType = linkType;
        LinkTarget = linkTarget.Trim();
        GroupKey = groupKey.Trim();
        GroupTitle = groupTitle.Trim();
        IsPopular = isPopular;
        IsVisible = isVisible;
        RequiresAuth = requiresAuth;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public void SetOrder(int order)
    {
        Order = order;
        UpdatedAt = DateTime.UtcNow;
    }
}
