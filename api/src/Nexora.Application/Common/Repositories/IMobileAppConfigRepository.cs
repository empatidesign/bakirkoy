using Nexora.Domain.Entities.MobileConfig;

namespace Nexora.Application.Common.Repositories;

public interface IMobileAppConfigRepository : IRepository<MobileAppConfig>
{
    Task<MobileAppConfig?> GetSingletonAsync(CancellationToken ct);
}
