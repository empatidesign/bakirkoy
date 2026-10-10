using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.DeviceMonitor;
using Nexora.Application.Features.DeviceMonitor.Dtos;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Services;

public class DeviceMonitorService(IUnitOfWork uow, IRedisService redis) : IDeviceMonitorService
{
    public async Task<DeviceMonitorSnapshotDto> GetSnapshotAsync(CancellationToken ct)
    {
        var libraryDevices = await uow.LibraryDevices.GetAllAsync(ct);
        var facilityDevices = await uow.FacilityDevices.GetAllAsync(ct);

        var libraryIds = libraryDevices.Select(d => d.LibraryId).Distinct().ToList();
        var libraries = (await uow.Libraries.FindAsync(l => libraryIds.Contains(l.Id), ct))
            .ToDictionary(l => l.Id, l => l.Name);

        var facilityIds = facilityDevices.Where(d => d.FacilityId.HasValue).Select(d => d.FacilityId!.Value).Distinct().ToList();
        var facilities = facilityIds.Count == 0
            ? new Dictionary<Guid, (string Name, string Module)>()
            : (await uow.Facilities.FindAsync(f => facilityIds.Contains(f.Id), ct))
                .ToDictionary(f => f.Id, f => (f.Name, f.Module));

        var heartbeatKeys = libraryDevices.Select(d => LibraryWebhookService.HeartbeatKey(d.Id))
            .Concat(facilityDevices.Select(d => LiderTekWebhookService.HeartbeatKey(d.Id)))
            .ToList();
        var heartbeats = await redis.GetManyHeartbeatsAsync(heartbeatKeys, ct);

        var items = new List<DeviceMonitorItemDto>(libraryDevices.Count + facilityDevices.Count);

        foreach (var d in libraryDevices)
        {
            var lastSeen = heartbeats.GetValueOrDefault(LibraryWebhookService.HeartbeatKey(d.Id));
            items.Add(new DeviceMonitorItemDto(
                d.Id.ToString(), "library", d.Name, d.Direction, d.DeviceCode, d.DeviceId,
                d.IsActive, lastSeen is not null, lastSeen,
                d.LibraryId.ToString(), libraries.GetValueOrDefault(d.LibraryId, "Bilinmeyen Kütüphane"), "library", d.OperationMode));
        }

        foreach (var d in facilityDevices)
        {
            var lastSeen = heartbeats.GetValueOrDefault(LiderTekWebhookService.HeartbeatKey(d.Id));
            var parent = d.FacilityId.HasValue ? facilities.GetValueOrDefault(d.FacilityId.Value) : default;
            items.Add(new DeviceMonitorItemDto(
                d.Id.ToString(), d.Module, d.Name, d.Direction, d.DeviceCode, d.DeviceId,
                d.IsActive, lastSeen is not null, lastSeen,
                d.FacilityId?.ToString() ?? d.ServiceFacilityId?.ToString() ?? "", parent.Name ?? d.Module, d.Module, null));
        }

        var online = items.Count(x => x.IsOnline);
        return new DeviceMonitorSnapshotDto(items, online, items.Count - online, DateTime.UtcNow);
    }
}
