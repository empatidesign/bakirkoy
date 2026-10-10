using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.MobileMenu;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class MobileMenuBannerRepository(AppDbContext context)
    : Repository<MobileMenuBanner>(context), IMobileMenuBannerRepository
{
    public Task<MobileMenuBanner?> GetByPageKeyAsync(string pageKey, CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(x => x.PageKey == pageKey, ct);
}
