using Nexora.Domain.Entities.MobileMenu;

namespace Nexora.Application.Common.Repositories;

public interface IMobileMenuItemRepository : IRepository<MobileMenuItem>
{
    Task<List<MobileMenuItem>> GetAllOrderedAsync(CancellationToken ct);
    Task<List<MobileMenuItem>> GetVisibleAsync(CancellationToken ct);
    Task<int> MaxOrderAsync(CancellationToken ct);
}
