using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ScopeNodeRepository(AppDbContext context)
    : Repository<ScopeNode>(context), IScopeNodeRepository
{
    public async Task<ScopeNode?> GetByRefAsync(string refModuleKey, Guid refId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.RefModuleKey == refModuleKey && x.RefId == refId, ct);

    public async Task<List<ScopeNode>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct)
        => ids.Count == 0
            ? []
            : await DbSet.Where(x => ids.Contains(x.Id)).ToListAsync(ct);
}
