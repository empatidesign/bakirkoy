using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ScopeEdgeRepository(AppDbContext context)
    : Repository<ScopeEdge>(context), IScopeEdgeRepository
{
    public async Task<List<ScopeEdge>> GetByParentAsync(Guid parentNodeId, CancellationToken ct)
        => await DbSet.Where(x => x.ParentNodeId == parentNodeId).ToListAsync(ct);
}
