using Nexora.Domain.Enums;

namespace Nexora.Application.Features.AppMenu.Requests;

public record UpsertSystemModuleRequest(
    string Label,
    string Icon,
    string Color,
    string CitizenRoute,
    string AdminRoute,
    bool IsActive,
    int AdminSidebarOrder,
    bool ShowInAdminSidebar);

public record ReorderSystemModulesRequest(List<string> OrderedIds);

public record CreateMenuSectionRequest(
    string Key,
    string Title,
    string Icon,
    bool IsVisible,
    bool ShowInSidebar,
    bool ShowInMobile);

public record UpdateMenuSectionRequest(
    string Title,
    string Icon,
    bool IsVisible,
    bool ShowInSidebar,
    bool ShowInMobile);

public record ReorderMenuSectionsRequest(List<string> OrderedIds);

public record CreateMenuItemRequest(
    string SectionId,
    string? ModuleKey,
    string Title,
    string Icon,
    MenuIconType IconType,
    string Color,
    MenuLinkType LinkType,
    string LinkTarget,
    string? MobileLinkTarget,
    bool ShowInSidebar,
    bool ShowInMobile,
    bool IsPopular,
    bool IsVisible,
    bool RequiresAuth,
    string? BadgeText,
    string? BadgeTone);

public record UpdateMenuItemRequest(
    string SectionId,
    string? ModuleKey,
    string Title,
    string Icon,
    MenuIconType IconType,
    string Color,
    MenuLinkType LinkType,
    string LinkTarget,
    string? MobileLinkTarget,
    bool ShowInSidebar,
    bool ShowInMobile,
    bool IsPopular,
    bool IsVisible,
    bool RequiresAuth,
    string? BadgeText,
    string? BadgeTone);

public record ReorderMenuItemsRequest(List<string> OrderedIds);
