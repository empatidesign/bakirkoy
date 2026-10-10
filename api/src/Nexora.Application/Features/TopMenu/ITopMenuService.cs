using Nexora.Application.Features.TopMenu.Dtos;
using Nexora.Application.Features.TopMenu.Requests;

namespace Nexora.Application.Features.TopMenu;

public interface ITopMenuService
{
    Task<List<TopMenuItemDto>> GetAllAsync(CancellationToken ct);
    Task<List<TopMenuItemDto>> GetPublicAsync(CancellationToken ct);
    Task<TopMenuItemDto> CreateAsync(CreateTopMenuItemRequest req, CancellationToken ct);
    Task<TopMenuItemDto> UpdateAsync(Guid id, UpdateTopMenuItemRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task ReorderAsync(ReorderTopMenuItemsRequest req, CancellationToken ct);
}
