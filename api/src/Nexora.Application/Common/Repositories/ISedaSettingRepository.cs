using Nexora.Domain.Entities.Seda;

namespace Nexora.Application.Common.Repositories;

public interface ISedaSettingRepository : IRepository<SedaSetting>
{
    Task<SedaSetting?> GetSingletonAsync(CancellationToken ct);
}
