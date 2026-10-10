using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Features.Notifications;

namespace Nexora.Api.Hubs;

public class NotificationRealtimeNotifier(
    IHubContext<TeamHub> teamHub,
    IHubContext<CitizenHub> citizenHub) : INotificationRealtimeNotifier
{
    public Task NotifyAdminAsync(Guid adminId, AdminNotificationPayload payload, CancellationToken ct = default)
        => teamHub.Clients.Group(TeamHub.GroupFor(adminId)).SendAsync("notification", payload, ct);

    public Task NotifyCitizenAsync(Guid participantId, CitizenNotificationPayload payload, CancellationToken ct = default)
        => citizenHub.Clients.Group(CitizenHub.GroupFor(participantId)).SendAsync("notification", payload, ct);
}
