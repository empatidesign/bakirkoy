using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Application.Common.Repositories;

public interface ISystemModuleRepository : IRepository<SystemModule>
{
    Task<List<SystemModule>> GetAllOrderedAsync(CancellationToken ct);
    Task<SystemModule?> GetByKeyAsync(string key, CancellationToken ct);
    Task<int> MaxAdminOrderAsync(CancellationToken ct);
}

public interface IMenuSectionRepository : IRepository<MenuSection>
{
    Task<List<MenuSection>> GetAllOrderedAsync(CancellationToken ct);
    Task<List<MenuSection>> GetWithItemsAsync(CancellationToken ct);
    Task<List<MenuSection>> GetVisibleWithItemsAsync(CancellationToken ct);
    Task<MenuSection?> GetByKeyAsync(string key, CancellationToken ct);
    Task<int> MaxOrderAsync(CancellationToken ct);
}

public interface IMenuItemRepository : IRepository<MenuItem>
{
    Task<List<MenuItem>> GetBySectionAsync(Guid sectionId, CancellationToken ct);
    Task<int> MaxOrderInSectionAsync(Guid sectionId, CancellationToken ct);
}

public interface ITopMenuItemRepository : IRepository<TopMenuItem>
{
    Task<List<TopMenuItem>> GetAllOrderedAsync(CancellationToken ct);
    Task<List<TopMenuItem>> GetVisibleOrderedAsync(CancellationToken ct);
    Task<int> MaxOrderAsync(CancellationToken ct);
}
