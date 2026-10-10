using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.AppMenu;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SystemModuleRepository(AppDbContext context)
    : Repository<SystemModule>(context), ISystemModuleRepository
{
    public Task<List<SystemModule>> GetAllOrderedAsync(CancellationToken ct)
        => DbSet.OrderBy(x => x.AdminSidebarOrder).ToListAsync(ct);

    public Task<SystemModule?> GetByKeyAsync(string key, CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(x => x.Key == key, ct);

    public async Task<int> MaxAdminOrderAsync(CancellationToken ct)
        => await DbSet.AnyAsync(ct) ? await DbSet.MaxAsync(x => x.AdminSidebarOrder, ct) : -1;
}

public class MenuSectionRepository(AppDbContext context)
    : Repository<MenuSection>(context), IMenuSectionRepository
{
    public Task<List<MenuSection>> GetAllOrderedAsync(CancellationToken ct)
        => DbSet.OrderBy(x => x.Order).ToListAsync(ct);

    public Task<List<MenuSection>> GetWithItemsAsync(CancellationToken ct)
        => DbSet.Include(x => x.Items.Where(i => !i.IsDeleted).OrderBy(i => i.Order))
                .OrderBy(x => x.Order)
                .ToListAsync(ct);

    public Task<List<MenuSection>> GetVisibleWithItemsAsync(CancellationToken ct)
        => DbSet.Where(x => x.IsVisible)
                .Include(x => x.Items.Where(i => !i.IsDeleted && i.IsVisible).OrderBy(i => i.Order))
                .OrderBy(x => x.Order)
                .ToListAsync(ct);

    public Task<MenuSection?> GetByKeyAsync(string key, CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(x => x.Key == key, ct);

    public async Task<int> MaxOrderAsync(CancellationToken ct)
        => await DbSet.AnyAsync(ct) ? await DbSet.MaxAsync(x => x.Order, ct) : -1;
}

public class MenuItemRepository(AppDbContext context)
    : Repository<MenuItem>(context), IMenuItemRepository
{
    public Task<List<MenuItem>> GetBySectionAsync(Guid sectionId, CancellationToken ct)
        => DbSet.Where(x => x.SectionId == sectionId).OrderBy(x => x.Order).ToListAsync(ct);

    public async Task<int> MaxOrderInSectionAsync(Guid sectionId, CancellationToken ct)
        => await DbSet.Where(x => x.SectionId == sectionId).AnyAsync(ct)
            ? await DbSet.Where(x => x.SectionId == sectionId).MaxAsync(x => x.Order, ct)
            : -1;
}

public class TopMenuItemRepository(AppDbContext context)
    : Repository<TopMenuItem>(context), ITopMenuItemRepository
{
    public Task<List<TopMenuItem>> GetAllOrderedAsync(CancellationToken ct)
        => DbSet.OrderBy(x => x.Order).ToListAsync(ct);

    public Task<List<TopMenuItem>> GetVisibleOrderedAsync(CancellationToken ct)
        => DbSet.Where(x => x.IsVisible).OrderBy(x => x.Order).ToListAsync(ct);

    public async Task<int> MaxOrderAsync(CancellationToken ct)
        => await DbSet.AnyAsync(ct) ? await DbSet.MaxAsync(x => x.Order, ct) : -1;
}
