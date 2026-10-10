namespace Nexora.Application.Features.TopMenu.Dtos;

public record TopMenuItemDto(
    string Id,
    string Title,
    string Icon,
    int IconType,
    string Color,
    int LinkType,
    string LinkTarget,
    bool OpenInBlank,
    bool IsVisible,
    int Order);
