using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class AdminPermissionRepository(AppDbContext context)
    : Repository<AdminPermission>(context), IAdminPermissionRepository
{
    public async Task<List<AdminPermission>> GetByAdminUserAsync(Guid adminUserId, CancellationToken ct)
        => await DbSet.Where(x => x.AdminUserId == adminUserId).ToListAsync(ct);
}
