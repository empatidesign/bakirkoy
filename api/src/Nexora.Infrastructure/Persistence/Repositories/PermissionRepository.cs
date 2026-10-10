using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class PermissionRepository(AppDbContext context)
    : Repository<Permission>(context), IPermissionRepository
{
    public async Task<List<Permission>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(p => p.IsActive).ToListAsync(ct);

    public async Task<List<Permission>> GetByKeysAsync(IEnumerable<string> keys, CancellationToken ct)
    {
        var set = keys.Distinct().ToList();
        return await DbSet.Where(p => set.Contains(p.Key)).ToListAsync(ct);
    }

    public async Task<List<Permission>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var set = ids.Distinct().ToList();
        return await DbSet.Where(p => set.Contains(p.Id)).ToListAsync(ct);
    }
}
