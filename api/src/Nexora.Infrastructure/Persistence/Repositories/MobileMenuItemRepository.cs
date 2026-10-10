using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.MobileMenu;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class MobileMenuItemRepository(AppDbContext context)
    : Repository<MobileMenuItem>(context), IMobileMenuItemRepository
{
    public Task<List<MobileMenuItem>> GetAllOrderedAsync(CancellationToken ct)
        => DbSet.OrderBy(x => x.GroupKey).ThenBy(x => x.Order).ToListAsync(ct);

    public Task<List<MobileMenuItem>> GetVisibleAsync(CancellationToken ct)
        => DbSet.Where(x => x.IsVisible).OrderBy(x => x.Order).ToListAsync(ct);

    public async Task<int> MaxOrderAsync(CancellationToken ct)
        => await DbSet.AnyAsync(ct) ? await DbSet.MaxAsync(x => x.Order, ct) : -1;
}
