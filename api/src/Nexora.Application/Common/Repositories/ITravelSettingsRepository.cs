using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelSettingsRepository : IRepository<TravelSettingsRecord>
{
    Task<TravelSettingsRecord?> GetSingletonAsync(CancellationToken ct);
}
