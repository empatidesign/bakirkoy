using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Features.MobileConfig;

namespace Nexora.Api.Hubs;

public class MobileConfigRealtimeNotifier(
    IHubContext<MobileConfigHub> hub) : IMobileConfigRealtimeNotifier
{
    public Task NotifyConfigChangedAsync(CancellationToken ct = default)
        => hub.Clients.All.SendAsync("config-changed", ct);
}
