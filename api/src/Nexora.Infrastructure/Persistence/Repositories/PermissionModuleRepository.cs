using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Auth;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class PermissionModuleRepository(AppDbContext context)
    : Repository<PermissionModule>(context), IPermissionModuleRepository
{
    public async Task<List<PermissionModule>> GetAllOrderedAsync(CancellationToken ct)
        => await DbSet.OrderBy(m => m.DisplayOrder).ThenBy(m => m.Name).ToListAsync(ct);
}
