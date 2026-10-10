using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Redis yapılandırılmamışsa kullanılan boş uygulama. Online takibi kritik olmayan
/// bir özelliktir; Redis yokken uygulamanın açılmasını engellememelidir.
/// </summary>
public class NullOnlineUserTracker : IOnlineUserTracker
{
    public Task TouchAsync(Guid userId, string userType, string? platform = null, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task<OnlineSnapshot> GetSnapshotAsync(CancellationToken ct = default)
        => Task.FromResult(OnlineSnapshot.Empty);
}
