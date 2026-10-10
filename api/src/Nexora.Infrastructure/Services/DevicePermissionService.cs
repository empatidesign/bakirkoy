using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.DevicePermissions;
using Nexora.Application.Features.DevicePermissions.Dtos;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Infrastructure.Services;

public class DevicePermissionService(IUnitOfWork uow) : IDevicePermissionService
{
    public async Task<DevicePermissionDto> GetAsync(Guid participantId, CancellationToken ct)
    {
        var perm = await uow.ParticipantDevicePermissions.GetByParticipantAsync(participantId, ct);
        return Map(perm);
    }

    public async Task<DevicePermissionDto> SaveAsync(Guid participantId, SaveDevicePermissionRequest req, CancellationToken ct)
    {
        var perm = await uow.ParticipantDevicePermissions.GetByParticipantAsync(participantId, ct);
        var isNew = perm is null;
        if (perm is null)
            perm = ParticipantDevicePermission.Create(participantId);

        if (req.LocationStatus is not null)
        {
            if (!PermissionStatuses.IsValid(req.LocationStatus))
                throw new Nexora.Application.Common.Exceptions.ValidationException(
                    "Geçersiz konum izin durumu.",
                    new Dictionary<string, string[]> { ["locationStatus"] = ["Geçersiz konum izin durumu."] });
            perm.SetLocation(req.LocationStatus, req.Latitude, req.Longitude);
        }

        if (req.NotificationStatus is not null)
        {
            if (!PermissionStatuses.IsValid(req.NotificationStatus))
                throw new Nexora.Application.Common.Exceptions.ValidationException(
                    "Geçersiz bildirim izin durumu.",
                    new Dictionary<string, string[]> { ["notificationStatus"] = ["Geçersiz bildirim izin durumu."] });
            perm.SetNotification(req.NotificationStatus, req.PushToken, req.DevicePlatform);

            // Çıkışta cihaz token'ı silinir: aksi halde çıkan kullanıcının
            // kaydında kalır ve bildirimleri cihazı sonra kullanan kişiye
            // düşer. SetNotification boş token'ı yok saydığı için ayrı adım.
            if (string.IsNullOrWhiteSpace(req.PushToken)
                && req.NotificationStatus is PermissionStatuses.Denied)
            {
                perm.ClearPushToken();
            }
        }

        if (isNew)
            await uow.ParticipantDevicePermissions.AddAsync(perm, ct);
        else
            uow.ParticipantDevicePermissions.Update(perm);
        await uow.SaveChangesAsync(ct);
        return Map(perm);
    }

    private static DevicePermissionDto Map(ParticipantDevicePermission? perm)
    {
        if (perm is null)
            return new DevicePermissionDto(
                PermissionStatuses.NotAsked, PermissionStatuses.NotAsked,
                null, null, null, false, null, null, false);

        return new DevicePermissionDto(
            perm.LocationStatus,
            perm.NotificationStatus,
            perm.Latitude,
            perm.Longitude,
            perm.LocationUpdatedAt,
            !string.IsNullOrWhiteSpace(perm.PushToken),
            perm.DevicePlatform,
            perm.RespondedAt,
            perm.RespondedAt.HasValue);
    }
}
