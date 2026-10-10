using Nexora.Application.Features.AppMenu.Dtos;
using Nexora.Application.Features.AppMenu.Requests;

namespace Nexora.Application.Features.AppMenu;

public interface IAppMenuService
{
    Task<List<SystemModuleDto>> GetSystemModulesAsync(CancellationToken ct);
    Task<SystemModuleDto> UpsertSystemModuleAsync(string key, UpsertSystemModuleRequest req, CancellationToken ct);
    Task SetModuleActiveAsync(string key, bool isActive, CancellationToken ct);
    Task ReorderSystemModulesAsync(ReorderSystemModulesRequest req, CancellationToken ct);

    Task<List<MenuSectionDto>> GetSectionsWithItemsAsync(CancellationToken ct);
    Task<List<MenuSectionDto>> GetPublicMenuAsync(CancellationToken ct);
    Task<MenuSectionDto> CreateSectionAsync(CreateMenuSectionRequest req, CancellationToken ct);
    Task<MenuSectionDto> UpdateSectionAsync(Guid id, UpdateMenuSectionRequest req, CancellationToken ct);
    Task DeleteSectionAsync(Guid id, CancellationToken ct);
    Task ReorderSectionsAsync(ReorderMenuSectionsRequest req, CancellationToken ct);

    Task<MenuItemDto> CreateItemAsync(CreateMenuItemRequest req, CancellationToken ct);
    Task<MenuItemDto> UpdateItemAsync(Guid id, UpdateMenuItemRequest req, CancellationToken ct);
    Task DeleteItemAsync(Guid id, CancellationToken ct);
    Task ReorderItemsAsync(Guid sectionId, ReorderMenuItemsRequest req, CancellationToken ct);
}
