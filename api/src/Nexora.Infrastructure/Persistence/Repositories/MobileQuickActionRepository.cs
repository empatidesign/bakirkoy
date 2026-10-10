using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.MobileConfig;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class MobileQuickActionRepository(AppDbContext context)
    : Repository<MobileQuickAction>(context), IMobileQuickActionRepository
{
    public Task<List<MobileQuickAction>> GetOrderedAsync(CancellationToken ct)
        => DbSet.OrderBy(x => x.SortOrder).ThenBy(x => x.Label).ToListAsync(ct);
}
