using Nexora.Domain.Entities.SystemBranding;

namespace Nexora.Application.Common.Repositories;

public interface ISystemBrandingRepository : IRepository<SystemBranding>
{
    Task<SystemBranding?> GetSingletonAsync(CancellationToken ct);
}
