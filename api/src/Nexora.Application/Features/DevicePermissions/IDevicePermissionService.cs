using Nexora.Application.Features.DevicePermissions.Dtos;

namespace Nexora.Application.Features.DevicePermissions;

public interface IDevicePermissionService
{
    Task<DevicePermissionDto> GetAsync(Guid participantId, CancellationToken ct);

    Task<DevicePermissionDto> SaveAsync(Guid participantId, SaveDevicePermissionRequest req, CancellationToken ct);
}
