using Nexora.Application.Features.DeviceMonitor.Dtos;

namespace Nexora.Application.Features.DeviceMonitor;

public interface IDeviceMonitorNotifier
{
    Task NotifyScanAsync(DeviceScanEventDto payload, CancellationToken ct = default);
}
