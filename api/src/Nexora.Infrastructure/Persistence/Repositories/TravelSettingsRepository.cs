using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TravelSettingsRepository(AppDbContext context)
    : Repository<TravelSettingsRecord>(context), ITravelSettingsRepository
{
    public async Task<TravelSettingsRecord?> GetSingletonAsync(CancellationToken ct)
        => await DbSet.OrderBy(e => e.CreatedAt).FirstOrDefaultAsync(ct);
}
