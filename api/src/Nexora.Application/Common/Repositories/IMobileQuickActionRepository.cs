using Nexora.Domain.Entities.MobileConfig;

namespace Nexora.Application.Common.Repositories;

public interface IMobileQuickActionRepository : IRepository<MobileQuickAction>
{
    /// <summary>Tüm kartları panel sırasıyla verir (pasifler dahil).</summary>
    Task<List<MobileQuickAction>> GetOrderedAsync(CancellationToken ct);
}
