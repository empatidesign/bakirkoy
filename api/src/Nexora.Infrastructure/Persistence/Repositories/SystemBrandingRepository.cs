using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.SystemBranding;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SystemBrandingRepository(AppDbContext context)
    : Repository<SystemBranding>(context), ISystemBrandingRepository
{
    public Task<SystemBranding?> GetSingletonAsync(CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(x => x.Id == SystemBranding.SingletonId, ct);
}
