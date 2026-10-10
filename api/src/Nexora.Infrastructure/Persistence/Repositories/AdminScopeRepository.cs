using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class AdminScopeRepository(AppDbContext context)
    : Repository<AdminScope>(context), IAdminScopeRepository
{
    public async Task<List<AdminScope>> GetByAdminUserAsync(Guid adminUserId, CancellationToken ct)
        => await DbSet.Where(x => x.AdminUserId == adminUserId).ToListAsync(ct);

    public async Task<List<AdminScope>> GetByAdminUsersAsync(IReadOnlyCollection<Guid> adminUserIds, CancellationToken ct)
        => adminUserIds.Count == 0
            ? []
            : await DbSet.Where(x => adminUserIds.Contains(x.AdminUserId)).ToListAsync(ct);

    public async Task<List<AdminScope>> GetByScopeNodeAsync(Guid scopeNodeId, CancellationToken ct)
        => await DbSet.Where(x => x.ScopeNodeId == scopeNodeId).ToListAsync(ct);

    public void HardRemoveRange(IEnumerable<AdminScope> entities) => DbSet.RemoveRange(entities);
}
