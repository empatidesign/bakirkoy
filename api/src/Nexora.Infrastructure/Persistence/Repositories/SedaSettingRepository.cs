using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SedaSettingRepository(AppDbContext context)
    : Repository<SedaSetting>(context), ISedaSettingRepository
{
    public async Task<SedaSetting?> GetSingletonAsync(CancellationToken ct)
        => await DbSet.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
}
