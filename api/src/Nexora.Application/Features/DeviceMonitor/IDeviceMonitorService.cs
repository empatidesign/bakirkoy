using Nexora.Application.Features.DeviceMonitor.Dtos;

namespace Nexora.Application.Features.DeviceMonitor;

public interface IDeviceMonitorService
{
    Task<DeviceMonitorSnapshotDto> GetSnapshotAsync(CancellationToken ct);
}
