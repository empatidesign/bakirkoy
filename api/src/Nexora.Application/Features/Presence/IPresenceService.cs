using Nexora.Application.Features.Presence.Dtos;

namespace Nexora.Application.Features.Presence;

public interface IPresenceService
{
    Task HeartbeatAsync(Guid userId, string? device, CancellationToken ct);
    Task GoOfflineAsync(Guid userId, CancellationToken ct);
    Task<IReadOnlyList<OnlinePersonDto>> GetOnlineVisibleAsync(Guid callerId, CancellationToken ct);
    Task<PresenceBroadcastResult> BroadcastAsync(Guid callerId, PresenceBroadcastRequest request, CancellationToken ct);
}
