using Microsoft.AspNetCore.SignalR;
using Nexora.Application.Features.DeviceMonitor;
using Nexora.Application.Features.DeviceMonitor.Dtos;

namespace Nexora.Api.Hubs;

public class DeviceMonitorNotifier(IHubContext<DeviceMonitorHub> hub, ILogger<DeviceMonitorNotifier> logger) : IDeviceMonitorNotifier
{
    public async Task NotifyScanAsync(DeviceScanEventDto payload, CancellationToken ct = default)
    {
        try
        {
            await hub.Clients.Group(DeviceMonitorHub.GroupName).SendAsync("device-scan", payload, ct);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "device-scan bildirimi gönderilemedi (device {DeviceId})", payload.DeviceId);
        }
    }
}
