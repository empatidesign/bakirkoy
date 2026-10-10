using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class ModuleNotificationSettingsRepository(AppDbContext context)
    : Repository<ModuleNotificationSettings>(context), IModuleNotificationSettingsRepository
{
    public async Task<ModuleNotificationSettings?> GetByModuleAsync(string module, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Module == module, ct);
}
