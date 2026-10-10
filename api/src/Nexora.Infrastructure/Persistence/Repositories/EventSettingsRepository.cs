using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EventSettingsRepository(AppDbContext context)
    : Repository<EventSettingsRecord>(context), IEventSettingsRepository
{
    public async Task<EventSettingsRecord?> GetCurrentAsync(CancellationToken ct)
        => await DbSet.OrderBy(x => x.CreatedAt).FirstOrDefaultAsync(ct);
}
