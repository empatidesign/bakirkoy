using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.MobileConfig;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class MobileAppConfigRepository(AppDbContext context)
    : Repository<MobileAppConfig>(context), IMobileAppConfigRepository
{
    public Task<MobileAppConfig?> GetSingletonAsync(CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(x => x.Id == MobileAppConfig.SingletonId, ct);
}
