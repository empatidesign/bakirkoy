using Nexora.Domain.Entities.Events;

namespace Nexora.Application.Common.Repositories;

public interface IEventSettingsRepository : IRepository<EventSettingsRecord>
{
    Task<EventSettingsRecord?> GetCurrentAsync(CancellationToken ct);
}
