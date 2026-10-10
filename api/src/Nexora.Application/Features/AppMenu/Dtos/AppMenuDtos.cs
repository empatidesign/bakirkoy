namespace Nexora.Application.Features.AppMenu.Dtos;

public record SystemModuleDto(
    string Id,
    string Key,
    string Label,
    string Icon,
    string Color,
    string CitizenRoute,
    string AdminRoute,
    bool IsActive,
    int AdminSidebarOrder,
    bool ShowInAdminSidebar);

public record MenuItemDto(
    string Id,
    string SectionId,
    string? ModuleKey,
    string Title,
    string Icon,
    int IconType,
    string Color,
    int LinkType,
    string LinkTarget,
    string? MobileLinkTarget,
    bool ShowInSidebar,
    bool ShowInMobile,
    bool IsPopular,
    bool IsVisible,
    bool RequiresAuth,
    string? BadgeText,
    string? BadgeTone,
    int Order);

public record MenuSectionDto(
    string Id,
    string Key,
    string Title,
    string Icon,
    bool IsVisible,
    bool ShowInSidebar,
    bool ShowInMobile,
    int Order,
    List<MenuItemDto> Items);

public record MenuSectionSummaryDto(
    string Id,
    string Key,
    string Title,
    string Icon,
    bool IsVisible,
    bool ShowInSidebar,
    bool ShowInMobile,
    int Order,
    int ItemCount);
