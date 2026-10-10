using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.MobileMenu;

public class MobileMenuBanner : BaseEntity
{
    public string PageKey { get; private set; } = string.Empty;
    public string ImageUrl { get; private set; } = string.Empty;
    public BannerLinkType LinkType { get; private set; }
    public string? LinkTarget { get; private set; }
    public bool IsVisible { get; private set; } = true;
    public int Order { get; private set; }

    public static MobileMenuBanner Create(
        string pageKey, string imageUrl, BannerLinkType linkType, string? linkTarget, bool isVisible, int order)
        => new()
        {
            PageKey = pageKey.Trim(),
            ImageUrl = imageUrl.Trim(),
            LinkType = linkType,
            LinkTarget = string.IsNullOrWhiteSpace(linkTarget) ? null : linkTarget.Trim(),
            IsVisible = isVisible,
            Order = order,
        };

    public void Update(string imageUrl, BannerLinkType linkType, string? linkTarget, bool isVisible)
    {
        ImageUrl = imageUrl.Trim();
        LinkType = linkType;
        LinkTarget = string.IsNullOrWhiteSpace(linkTarget) ? null : linkTarget.Trim();
        IsVisible = isVisible;
        UpdatedAt = DateTime.UtcNow;
    }
}
