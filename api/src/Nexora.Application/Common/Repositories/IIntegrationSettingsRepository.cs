using Nexora.Domain.Entities.Integrations;

namespace Nexora.Application.Common.Repositories;

public interface IIntegrationSettingsRepository : IRepository<IntegrationSettingsRecord>
{
    Task<IntegrationSettingsRecord?> GetCurrentAsync(CancellationToken ct);
}
