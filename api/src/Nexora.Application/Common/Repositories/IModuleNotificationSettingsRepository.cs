using Nexora.Domain.Entities.Notifications;

namespace Nexora.Application.Common.Repositories;

public interface IModuleNotificationSettingsRepository : IRepository<ModuleNotificationSettings>
{
    Task<ModuleNotificationSettings?> GetByModuleAsync(string module, CancellationToken ct);
}
