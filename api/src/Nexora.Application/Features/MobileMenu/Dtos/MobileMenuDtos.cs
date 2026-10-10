using Nexora.Domain.Enums;

namespace Nexora.Application.Features.MobileMenu.Dtos;

public record MobileMenuItemDto(
    Guid Id, string Title, string Icon, MenuIconType IconType, string Color,
    string? ColorSecondary, string? Description, MenuLinkType LinkType, string LinkTarget, string GroupKey, string GroupTitle,
    bool IsPopular, bool IsVisible, bool RequiresAuth, int Order);

public record CreateMobileMenuItemRequest(
    string Title, string Icon, MenuIconType IconType, string Color,
    string? ColorSecondary, string? Description, MenuLinkType LinkType, string LinkTarget, string GroupKey, string GroupTitle,
    bool IsPopular, bool IsVisible, bool RequiresAuth);

public record UpdateMobileMenuItemRequest(
    string Title, string Icon, MenuIconType IconType, string Color,
    string? ColorSecondary, string? Description, MenuLinkType LinkType, string LinkTarget, string GroupKey, string GroupTitle,
    bool IsPopular, bool IsVisible, bool RequiresAuth);

public record ReorderMobileMenuRequest(List<Guid> OrderedIds);

public record MobileMenuGroupDto(string GroupKey, string GroupTitle);

public record MobileMenuBannerDto(
    Guid Id, string PageKey, string ImageUrl, BannerLinkType LinkType, string? LinkTarget, bool IsVisible, int Order);

public record UpsertBannerRequest(
    string ImageUrl, BannerLinkType LinkType, string? LinkTarget, bool IsVisible);

public record PublicMenuItemDto(
    string Title, string Icon, MenuIconType IconType, string Color,
    string? ColorSecondary, string? Description,
    MenuLinkType LinkType, string LinkTarget, bool IsPopular);

public record PublicMenuGroupDto(string GroupKey, string GroupTitle, List<PublicMenuItemDto> Items);

public record PublicMenuResponse(List<PublicMenuGroupDto> Groups, List<PublicMenuItemDto> Popular);

public record PublicBannerDto(string PageKey, string ImageUrl, BannerLinkType LinkType, string? LinkTarget);
