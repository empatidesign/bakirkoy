using Nexora.Domain.Entities.MobileMenu;

namespace Nexora.Application.Common.Repositories;

public interface IMobileMenuBannerRepository : IRepository<MobileMenuBanner>
{
    Task<MobileMenuBanner?> GetByPageKeyAsync(string pageKey, CancellationToken ct);
}
