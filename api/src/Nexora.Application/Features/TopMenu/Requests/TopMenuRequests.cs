using Nexora.Domain.Enums;

namespace Nexora.Application.Features.TopMenu.Requests;

public record CreateTopMenuItemRequest(
    string Title,
    string Icon,
    MenuIconType IconType,
    string Color,
    TopMenuLinkType LinkType,
    string LinkTarget,
    bool OpenInBlank);

public record UpdateTopMenuItemRequest(
    string Title,
    string Icon,
    MenuIconType IconType,
    string Color,
    TopMenuLinkType LinkType,
    string LinkTarget,
    bool OpenInBlank,
    bool IsVisible,
    int Order);

public record ReorderTopMenuItemsRequest(List<string> OrderedIds);
