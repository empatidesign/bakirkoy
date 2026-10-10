using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Integrations;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class IntegrationSettingsRepository(AppDbContext context)
    : Repository<IntegrationSettingsRecord>(context), IIntegrationSettingsRepository
{
    public async Task<IntegrationSettingsRecord?> GetCurrentAsync(CancellationToken ct)
        => await DbSet.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
}
