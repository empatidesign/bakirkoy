using Nexora.Application.Features.Notifications.Dtos;

namespace Nexora.Application.Features.Notifications;

public interface INotificationBroadcastService
{
    Task<BroadcastResultDto> BroadcastAsync(BroadcastRequest req, CancellationToken ct);

    BroadcastTargetOptionsDto GetTargetOptions();
}
