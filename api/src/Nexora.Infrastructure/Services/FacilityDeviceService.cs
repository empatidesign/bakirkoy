using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class FacilityDeviceService(
    IUnitOfWork uow,
    ICurrentUser current,
    IFacilityDoorController door,
    IRedisService redis,
    IConfiguration config,
    IAuditService audit) : IFacilityDeviceService
{
    private const string HallModule = "event";

    public static string ForceOpenKey(Guid deviceId) => $"facility:device:force-open:{deviceId}";
    private int ForceOpenTtlSeconds => config.GetValue("FacilityDevice:ForceOpenTtlSeconds", 30);

    public async Task<List<FacilityDeviceDto>> GetByFacilityAsync(string module, Guid facilityId, CancellationToken ct)
    {
        var devices = await uow.FacilityDevices.GetByFacilityAsync(module, facilityId, ct);
        return devices.Select(d => ToDto(d)).ToList();
    }

    public async Task<List<FacilityDeviceDto>> GetByServiceFacilityAsync(string module, Guid serviceFacilityId, CancellationToken ct)
    {
        var devices = await uow.FacilityDevices.GetByServiceFacilityAsync(module, serviceFacilityId, ct);
        return devices.Select(d => ToDto(d)).ToList();
    }

    public async Task<FacilityDeviceDto> GetByIdAsync(string module, Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(module, id, ct);
        return await ToDtoAsync(device, ct);
    }

    public async Task<FacilityDeviceDto> CreateAsync(string module, CreateFacilityDeviceRequest req, CancellationToken ct)
    {
        var scope = FacilityDeviceScope.IsValid(req.Scope) ? req.Scope! : FacilityDeviceScope.Area;
        var (serviceFacilityId, facilityId, hallId) = await ResolveScopeTargetsAsync(module, scope, req.ServiceFacilityId, req.FacilityId, req.HallId, ct);
        var groupId = await ResolveGroupIdAsync(module, scope, facilityId, req.GroupId, ct);

        await GuardDeviceIdAsync(req.DeviceId, null, ct);

        var deviceCode = await GenerateCodeAsync(module, ct);
        var apiKey = LiderTekCrypto.GenerateDeviceApiKey();

        var device = FacilityDevice.Create(module, serviceFacilityId, facilityId,
            ToData(req.Name, req.Direction, scope, hallId, req.DeviceId, req.IpAddress, req.Port, req.Username, req.Password,
                req.RelayNo, req.RelayMs, req.WorkMode, req.HttpPath, req.TriggerLockOnSuccess, req.Description, groupId),
            deviceCode, apiKey, current.Name);

        await uow.FacilityDevices.AddAsync(device, ct);
        await uow.SaveChangesAsync(ct);
        return await ToDtoAsync(device, ct, revealKey: true);
    }

    public async Task<FacilityDeviceDto> UpdateAsync(string module, Guid id, UpdateFacilityDeviceRequest req, CancellationToken ct)
    {
        var device = await GetOwnedAsync(module, id, ct);
        var scope = FacilityDeviceScope.IsValid(req.Scope) ? req.Scope! : device.Scope;
        var hallId = scope == FacilityDeviceScope.Event ? (req.HallId ?? device.HallId) : null;
        var groupId = await ResolveGroupIdAsync(module, scope, device.FacilityId, req.GroupId, ct);

        await GuardDeviceIdAsync(req.DeviceId, id, ct);

        device.Update(ToData(req.Name, req.Direction, scope, hallId, req.DeviceId, req.IpAddress, req.Port, req.Username, PasswordOrKeep(req.Password, device),
            req.RelayNo, req.RelayMs, req.WorkMode, req.HttpPath, req.TriggerLockOnSuccess, req.Description, groupId));
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
        return await ToDtoAsync(device, ct);
    }

    public async Task DeleteAsync(string module, Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(module, id, ct);
        device.MarkDeleted(current.Name);
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<FacilityDeviceDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(module, id, ct);
        if (device.IsActive) device.Deactivate(); else device.Activate();
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
        return ToDto(device);
    }

    public async Task<FacilityDeviceDto> RotateKeyAsync(string module, Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(module, id, ct);
        device.RotateKey(LiderTekCrypto.GenerateDeviceApiKey());
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
        return ToDto(device, revealKey: true);
    }

    public async Task<FacilityDeviceTestResultDto> TestLockAsync(string module, Guid id, CancellationToken ct)
        => await RunTestLockAsync(await GetOwnedAsync(module, id, ct), ct);


    public async Task<List<FacilityDeviceDto>> GetByHallAsync(Guid hallId, CancellationToken ct)
    {
        var devices = await uow.FacilityDevices.GetByHallAsync(hallId, ct);
        return devices.Select(d => ToDto(d)).ToList();
    }

    public async Task<FacilityDeviceDto> CreateForHallAsync(Guid hallId, CreateHallDeviceRequest req, CancellationToken ct)
    {
        var hall = await uow.Halls.GetByIdAsync(hallId, ct)
            ?? throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");

        await GuardDeviceIdAsync(req.DeviceId, null, ct);

        var deviceCode = await GenerateCodeAsync(HallModule, ct);
        var apiKey = LiderTekCrypto.GenerateDeviceApiKey();

        var device = FacilityDevice.Create(HallModule, hall.FacilityId, null,
            ToData(req.Name, req.Direction, FacilityDeviceScope.Event, hallId, req.DeviceId, req.IpAddress, req.Port, req.Username, req.Password,
                req.RelayNo, req.RelayMs, req.WorkMode, req.HttpPath, req.TriggerLockOnSuccess, req.Description),
            deviceCode, apiKey, current.Name);

        await uow.FacilityDevices.AddAsync(device, ct);
        await uow.SaveChangesAsync(ct);
        return ToDto(device, revealKey: true);
    }

    public async Task<FacilityDeviceDto> UpdateHallDeviceAsync(Guid id, UpdateFacilityDeviceRequest req, CancellationToken ct)
    {
        var device = await GetHallDeviceAsync(id, ct);
        await GuardDeviceIdAsync(req.DeviceId, id, ct);
        device.Update(ToData(req.Name, req.Direction, FacilityDeviceScope.Event, device.HallId, req.DeviceId, req.IpAddress, req.Port, req.Username, PasswordOrKeep(req.Password, device),
            req.RelayNo, req.RelayMs, req.WorkMode, req.HttpPath, req.TriggerLockOnSuccess, req.Description));
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
        return ToDto(device);
    }

    public async Task DeleteHallDeviceAsync(Guid id, CancellationToken ct)
    {
        var device = await GetHallDeviceAsync(id, ct);
        device.MarkDeleted(current.Name);
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<FacilityDeviceDto> ToggleHallDeviceAsync(Guid id, CancellationToken ct)
    {
        var device = await GetHallDeviceAsync(id, ct);
        if (device.IsActive) device.Deactivate(); else device.Activate();
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
        return ToDto(device);
    }

    public async Task<FacilityDeviceDto> RotateHallDeviceKeyAsync(Guid id, CancellationToken ct)
    {
        var device = await GetHallDeviceAsync(id, ct);
        device.RotateKey(LiderTekCrypto.GenerateDeviceApiKey());
        uow.FacilityDevices.Update(device);
        await uow.SaveChangesAsync(ct);
        return ToDto(device, revealKey: true);
    }

    public async Task<FacilityDeviceTestResultDto> TestHallDeviceLockAsync(Guid id, CancellationToken ct)
        => await RunTestLockAsync(await GetHallDeviceAsync(id, ct), ct);

    public async Task<FacilityDeviceOpenResultDto> ManualOpenAsync(string module, Guid id, CancellationToken ct)
        => await RunManualOpenAsync(await GetOwnedAsync(module, id, ct), ct);

    public async Task<FacilityDeviceOpenResultDto> ManualOpenHallDeviceAsync(Guid id, CancellationToken ct)
        => await RunManualOpenAsync(await GetHallDeviceAsync(id, ct), ct);

    private async Task<FacilityDeviceOpenResultDto> RunManualOpenAsync(FacilityDevice device, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(device.IpAddress))
        {
            var directResult = await door.TriggerAsync(new FacilityDoorTriggerRequest(
                device.Id, device.Name, "manual",
                device.IpAddress, device.Port, device.Username, device.Password,
                device.RelayNo, device.RelayMs, device.HttpPath, true,
                device.WebhookUrl), ct);

            if (directResult.Opened)
            {
                await LogManualOpenAsync(device, opened: true, queued: false);
                return new FacilityDeviceOpenResultDto(true, false, "Kapı/turnike anlık olarak açıldı.");
            }

            if (device.WorkMode != "online")
            {
                await LogManualOpenAsync(device, opened: false, queued: false);
                return new FacilityDeviceOpenResultDto(false, false, directResult.ErrorMessage ?? "Kapı açılamadı.");
            }
        }

        if (device.WorkMode == "online")
        {
            await redis.SetAsync(ForceOpenKey(device.Id), current.Name ?? "manual", TimeSpan.FromSeconds(ForceOpenTtlSeconds), ct);
            await LogManualOpenAsync(device, opened: true, queued: true);
            return new FacilityDeviceOpenResultDto(true, true,
                $"Kapı açma komutu kuyruğa alındı. Cihaz bağlandığında ({ForceOpenTtlSeconds} sn içinde) açılacak.");
        }

        var result = await door.TriggerAsync(new FacilityDoorTriggerRequest(
            device.Id, device.Name, "manual",
            device.IpAddress, device.Port, device.Username, device.Password,
            device.RelayNo, device.RelayMs, device.HttpPath, true,
            device.WebhookUrl), ct);
        await LogManualOpenAsync(device, result.Opened, queued: false);
        return new FacilityDeviceOpenResultDto(result.Opened, false, result.Opened ? "Kapı/turnike açıldı." : result.ErrorMessage ?? "Kapı açılamadı.");
    }

    private async Task LogManualOpenAsync(FacilityDevice device, bool opened, bool queued)
    {
        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "FacilityDevice",
            EntityId = device.Id,
            Module = "FacilityDevice",
            Description = queued
                ? $"Kapı manuel açma kuyruğa alındı: {device.Name} ({current.Name})"
                : opened
                    ? $"Kapı manuel olarak açıldı: {device.Name} ({current.Name})"
                    : $"Kapı manuel açma başarısız: {device.Name} ({current.Name})",
        }, CancellationToken.None);
    }

    private async Task<FacilityDeviceTestResultDto> RunTestLockAsync(FacilityDevice device, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(device.IpAddress) && string.IsNullOrWhiteSpace(device.WebhookUrl))
            return new(false, "Cihazda IP adresi veya bariyer URL tanımlı değil. Kilit test edilemez.");

        var result = await door.TriggerAsync(new FacilityDoorTriggerRequest(
            device.Id, device.Name, "test",
            device.IpAddress, device.Port, device.Username, device.Password,
            device.RelayNo, device.RelayMs, device.HttpPath, true,
            device.WebhookUrl), ct);

        return result.Opened
            ? new(true, "Kilit sinyali gönderildi. Kapı açıldıysa test başarılı.")
            : new(false, result.ErrorMessage ?? "Kilit tetiklenemedi.");
    }

    private static FacilityDeviceData ToData(string name, string direction, string scope, Guid? hallId,
        string? deviceId, string? ip, int port, string? username, string? password, int relayNo, int relayMs,
        string workMode, string? httpPath, bool triggerLock, string? description, Guid? groupId = null)
        => new(name, direction, scope, hallId, deviceId, ip, port, username, password, relayNo, relayMs, workMode, httpPath, triggerLock, description, groupId);

    private static string? PasswordOrKeep(string? incoming, FacilityDevice device)
        => string.IsNullOrWhiteSpace(incoming) ? device.Password : incoming;

    private async Task<Guid?> ResolveGroupIdAsync(string module, string scope, Guid? facilityId, Guid? groupId, CancellationToken ct)
    {
        if (scope != FacilityDeviceScope.Area || groupId is null) return null;
        var group = await uow.FacilityGroups.GetByIdAsync(groupId.Value, ct);
        if (group is null || group.Module != module || (facilityId is not null && group.FacilityId != facilityId))
            throw new NotFoundException("Seçilen grup/salon bu tesise ait değil.", "GROUP_NOT_FOUND");
        return groupId;
    }

    private async Task<(Guid? ServiceFacilityId, Guid? FacilityId, Guid? HallId)> ResolveScopeTargetsAsync(
        string module, string scope, Guid? serviceFacilityId, Guid? facilityId, Guid? hallId, CancellationToken ct)
    {
        if (scope == FacilityDeviceScope.FacilityGeneral)
        {
            if (serviceFacilityId is null)
                throw new NotFoundException("Genel giriş cihazı için tesis seçilmelidir.", "SERVICE_FACILITY_REQUIRED");
            var sf = await uow.ServiceFacilities.GetByIdAsync(serviceFacilityId.Value, ct);
            if (sf is null)
                throw new NotFoundException("Tesis bulunamadı.", "SERVICE_FACILITY_NOT_FOUND");
            return (serviceFacilityId, null, null);
        }

        if (scope == FacilityDeviceScope.Event)
        {
            if (hallId is null)
                throw new NotFoundException("Etkinlik cihazı için salon seçilmelidir.", "HALL_REQUIRED");
            var hall = await uow.Halls.GetByIdAsync(hallId.Value, ct);
            if (hall is null)
                throw new NotFoundException("Salon bulunamadı.", "HALL_NOT_FOUND");
            return (hall.FacilityId, null, hallId);
        }

        if (facilityId is null)
            throw new NotFoundException("Cihaz için alan seçilmelidir.", "FACILITY_REQUIRED");
        var facility = await uow.Facilities.GetByIdAsync(facilityId.Value, ct);
        if (facility is null || facility.Module != module)
            throw new NotFoundException("Alan bulunamadı.", "FACILITY_NOT_FOUND");

        return (facility.ServiceFacilityId, facilityId, null);
    }

    private async Task GuardDeviceIdAsync(string? deviceId, Guid? excludeId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(deviceId)) return;
        if (await uow.FacilityDevices.ExistsBySerialNoAsync(deviceId.Trim(), excludeId, ct))
            throw new ConflictException("Bu Cihaz Id başka bir cihazda tanımlı.", "DEVICE_SERIAL_DUPLICATE");
    }

    private async Task<string> GenerateCodeAsync(string module, CancellationToken ct)
    {
        var prefix = module == HallModule ? "ETK"
            : FacilityModuleRegistry.Prefix.TryGetValue(module, out var p) ? p : "FAC";
        string code;
        do
        {
            code = $"{prefix}-DEV-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}";
        }
        while (await uow.FacilityDevices.ExistsByCodeAsync(code, ct));
        return code;
    }

    private async Task<FacilityDevice> GetOwnedAsync(string module, Guid id, CancellationToken ct)
    {
        var device = await uow.FacilityDevices.GetByIdAsync(id, ct);
        if (device is null || device.Module != module)
            throw new NotFoundException("Cihaz bulunamadı.", "DEVICE_NOT_FOUND");
        return device;
    }

    private async Task<FacilityDevice> GetHallDeviceAsync(Guid id, CancellationToken ct)
    {
        var device = await uow.FacilityDevices.GetByIdAsync(id, ct);
        if (device is null || device.Scope != FacilityDeviceScope.Event)
            throw new NotFoundException("Salon cihazı bulunamadı.", "DEVICE_NOT_FOUND");
        return device;
    }

    private static FacilityDeviceDto ToDto(FacilityDevice d, bool revealKey = false)
        => new(d.Id, d.Module, d.ServiceFacilityId, d.FacilityId, d.Scope, d.HallId, d.Name, d.Direction,
            d.DeviceId, d.IpAddress, d.Port, d.Username, !string.IsNullOrEmpty(d.Password),
            d.RelayNo, d.RelayMs, d.WorkMode, d.HttpPath, d.TriggerLockOnSuccess,
            d.DeviceCode, MaskApiKey(d.ApiKey, revealKey), d.Description, d.IsActive, d.CreatedAt, d.GroupId, null);

    private async Task<FacilityDeviceDto> ToDtoAsync(FacilityDevice d, CancellationToken ct, bool revealKey = false)
    {
        string? groupName = null;
        if (d.GroupId is Guid gid)
        {
            var group = await uow.FacilityGroups.GetByIdAsync(gid, ct);
            groupName = group?.Name;
        }
        return new(d.Id, d.Module, d.ServiceFacilityId, d.FacilityId, d.Scope, d.HallId, d.Name, d.Direction,
            d.DeviceId, d.IpAddress, d.Port, d.Username, !string.IsNullOrEmpty(d.Password),
            d.RelayNo, d.RelayMs, d.WorkMode, d.HttpPath, d.TriggerLockOnSuccess,
            d.DeviceCode, MaskApiKey(d.ApiKey, revealKey), d.Description, d.IsActive, d.CreatedAt, d.GroupId, groupName);
    }

    // Kod denetimi 2026-08-08 (kütüphane + spor/havuz denetim raporlarında tekrarlanan P3 bulgusu):
    // apiKey normal GET/list/update/toggle response'larında düz metin olarak dönüyordu. Cihaz oluşturma
    // ve anahtar döndürme (rotate-key) sırasında tam değer gösterilmesi gerekiyor (kullanıcı cihaza
    // yazması için görmeli), ama sonraki her okuma isteğinde maskelenmesi yeterli ve daha güvenli.
    private static string? MaskApiKey(string? apiKey, bool reveal)
    {
        if (reveal || string.IsNullOrEmpty(apiKey)) return apiKey;
        return apiKey.Length <= 8 ? "••••••••" : $"{apiKey[..4]}••••{apiKey[^4..]}";
    }
}
