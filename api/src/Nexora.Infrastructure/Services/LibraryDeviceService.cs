using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Domain.Enums;
namespace Nexora.Infrastructure.Services;

public class LibraryDeviceService(IUnitOfWork uow, ICurrentUser current, IUserScopeService userScope, ILibraryLockController locks, IRedisService redis, IConfiguration config, IAuditService audit, IOperationTemplateClassifier classifier) : ILibraryDeviceService
{
    public static string ForceOpenKey(Guid deviceId) => $"library:device:force-open:{deviceId}";
    private int ForceOpenTtlSeconds => config.GetValue("LibraryDevice:ForceOpenTtlSeconds", 30);

    // Kod denetimi (2026-08-14, kullanıcı isteği: "kütüphane cihaz giriş-çıkış sistemleri"
    // son kontrolü) — bu serviste hiç scope kontrolü YOKTU: scope'lu bir kütüphane personeli
    // (kiraathane-sorumlusu rolü zaten library.devices iznine sahip), başka bir kıraathanenin
    // cihazını ID ile görebiliyor/güncelleyebiliyor/silebiliyor/API anahtarını açığa
    // çıkarabiliyor/kilit testini (fiziksel kapı açma) uzaktan tetikleyebiliyordu. Aynı sınıf
    // (Madde 13) açık, Kütüphane/Etkinlik/Gezi modüllerinde önceki turlarda kapatılmıştı ama
    // cihaz alt sistemine hiç uygulanmamış.
    private async Task EnsureInScopeAsync(Guid libraryId, CancellationToken ct)
    {
        if (current.Id is not Guid uid) return;
        var scopedRefIds = await userScope.GetScopedRefIdsAsync(uid, "library", ct);
        if (scopedRefIds is not null && !scopedRefIds.Contains(libraryId))
            throw new NotFoundException("Kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");
    }

    public async Task<List<LibraryDeviceDto>> GetByLibraryAsync(Guid libraryId, CancellationToken ct)
    {
        await EnsureInScopeAsync(libraryId, ct);
        var devices = await uow.LibraryDevices.GetByLibraryAsync(libraryId, ct);
        var result = new List<LibraryDeviceDto>(devices.Count);
        foreach (var d in devices)
        {
            var lastSeen = await redis.GetAsync<DateTime?>(LibraryWebhookService.HeartbeatKey(d.Id), ct);
            result.Add(ToDto(d) with { LastSeenAt = lastSeen, IsOnline = lastSeen is not null });
        }
        return result;
    }

    public async Task<LibraryDeviceDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);
        var lastSeen = await redis.GetAsync<DateTime?>(LibraryWebhookService.HeartbeatKey(device.Id), ct);
        return ToDto(device) with { LastSeenAt = lastSeen, IsOnline = lastSeen is not null };
    }

    public async Task<LibraryDeviceDto> CreateAsync(Guid libraryId, CreateLibraryDeviceRequest req, CancellationToken ct)
    {
        var library = await uow.Libraries.GetByIdAsync(libraryId, ct)
            ?? throw new NotFoundException("Kütüphane bulunamadı.", "LIBRARY_NOT_FOUND");
        await EnsureInScopeAsync(libraryId, ct);
        if (!string.IsNullOrWhiteSpace(req.DeviceId) && await uow.LibraryDevices.ExistsByDeviceIdAsync(req.DeviceId, null, ct))
            throw new ConflictException($"'{req.DeviceId}' cihaz kimliği zaten başka bir kayıtta kullanılıyor.", "DEVICE_ID_IN_USE");
        var code = await GenerateCodeAsync(ct);
        var apiKey = LiderTekCrypto.GenerateDeviceApiKey();
        var device = LibraryDevice.Create(library.Id, ToData(req), code, apiKey, current.Name);
        await uow.LibraryDevices.AddAsync(device, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = $"Kütüphane cihazı eklendi: {device.Name}",
            NewValues = JsonSerializer.Serialize(Snapshot(device)),
        }, ct);

        return ToDto(device, revealApiKey: true);
    }

    public async Task<LibraryDeviceDto> UpdateAsync(Guid id, UpdateLibraryDeviceRequest req, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);
        var before = Snapshot(device);
        if (!string.IsNullOrWhiteSpace(req.DeviceId) && await uow.LibraryDevices.ExistsByDeviceIdAsync(req.DeviceId, id, ct))
            throw new ConflictException($"'{req.DeviceId}' cihaz kimliği zaten başka bir kayıtta kullanılıyor.", "DEVICE_ID_IN_USE");
        var effective = string.IsNullOrEmpty(req.Password) ? req with { Password = device.Password } : req;
        device.Update(ToData(effective));
        uow.LibraryDevices.Update(device);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = $"Kütüphane cihazı güncellendi: {device.Name}",
            OldValues = JsonSerializer.Serialize(before),
            NewValues = JsonSerializer.Serialize(Snapshot(device)),
        }, ct);

        return ToDto(device);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);
        var before = Snapshot(device);
        var libraryId = device.LibraryId;
        device.MarkDeleted(current.Name);
        uow.LibraryDevices.Update(device);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = $"Kütüphane cihazı silindi: {device.Name}",
            OldValues = JsonSerializer.Serialize(before),
        }, ct);

        // Hata #23: bir kütüphanenin cihazı silindiğinde (ör. FULL_BUSY_LIBRARY şablonu iki yönlü
        // cihaz + manyetik kilit gerektirir) ClassifyAsync hiç tetiklenmiyordu — assignedTemplate
        // artık gerçek donanımı yansıtmayan eski değerde donup kalıyordu (drift). Cihaz sayısı/
        // durumu değiştiğinde şablon otomatik yeniden hesaplanır.
        await classifier.ClassifyAsync(libraryId, ct);
    }

    public async Task<LibraryDeviceDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);
        if (device.IsActive) device.Deactivate(); else device.Activate();
        uow.LibraryDevices.Update(device);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = device.IsActive
                ? $"Kütüphane cihazı aktifleştirildi: {device.Name}"
                : $"Kütüphane cihazı pasifleştirildi: {device.Name}",
        }, ct);

        return ToDto(device);
    }

    public async Task<LibraryDeviceDto> RotateKeyAsync(Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);
        device.RotateKey(LiderTekCrypto.GenerateDeviceApiKey());
        uow.LibraryDevices.Update(device);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = $"Kütüphane cihazı anahtarı yenilendi: {device.Name}",
        }, ct);

        return ToDto(device, revealApiKey: true);
    }

    public async Task<string?> RevealApiKeyAsync(Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Export,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = $"Kütüphane cihazı API anahtarı görüntülendi: {device.Name}",
        }, ct);

        return device.ApiKey;
    }

    public async Task<LibraryDeviceDto> MoveToLibraryAsync(Guid id, Guid targetLibraryId, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);
        await EnsureInScopeAsync(targetLibraryId, ct);
        if (device.LibraryId == targetLibraryId) return ToDto(device);

        var sourceLibrary = await uow.Libraries.GetByIdAsync(device.LibraryId, ct);
        var targetLibrary = await uow.Libraries.GetByIdAsync(targetLibraryId, ct)
            ?? throw new NotFoundException("Hedef kıraathane bulunamadı.", "LIBRARY_NOT_FOUND");

        device.MoveToLibrary(targetLibraryId);
        uow.LibraryDevices.Update(device);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "LibraryDevice",
            EntityId = device.Id,
            Module = "Library",
            Description = $"Kütüphane cihazı taşındı: {device.Name} — '{sourceLibrary?.Name}' → '{targetLibrary.Name}'",
        }, ct);

        return ToDto(device);
    }

    public async Task<LibraryDeviceTestResultDto> TestLockAsync(Guid id, CancellationToken ct)
    {
        var device = await GetOwnedAsync(id, ct);

        if (!device.TriggerLockOnSuccess)
            return new LibraryDeviceTestResultDto(false, "Bu cihazda 'Kapı Tetiği' kapalı — manyetik kilit tetiklenmez.");
        if (!string.IsNullOrWhiteSpace(device.IpAddress))
        {
            var directResult = await locks.TriggerAsync(device, device.Direction, ct);
            if (directResult.Opened)
            {
                await audit.LogAsync(new AuditEntry
                {
                    Action = AuditAction.Update,
                    EntityType = "LibraryDevice",
                    EntityId = device.Id,
                    Module = "Library",
                    Description = $"Kilit testi anlık tetiklendi (IP: {device.IpAddress}): {device.Name}",
                }, ct);
                return new LibraryDeviceTestResultDto(true, "Kilit anlık olarak tetiklendi.");
            }

            if (device.WorkMode != "online")
                return new LibraryDeviceTestResultDto(false, directResult.ErrorMessage ?? "Kilit tetiklenemedi.");
        }

        if (device.WorkMode == "online")
        {
            if (string.IsNullOrWhiteSpace(device.DeviceId))
                return new LibraryDeviceTestResultDto(false, "Cihaz Id tanımlı değil. Online cihaz için cihazın Device_Id değerini girin.");

            await redis.SetAsync(ForceOpenKey(device.Id), current.Name ?? "test", TimeSpan.FromSeconds(ForceOpenTtlSeconds), ct);
            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Update,
                EntityType = "LibraryDevice",
                EntityId = device.Id,
                Module = "Library",
                Description = $"Kilit testi kuyruklandı (online): {device.Name}",
            }, ct);
            return new LibraryDeviceTestResultDto(true, $"Kapı açma komutu kuyruğa alındı. Cihaz bağlandığında ({ForceOpenTtlSeconds} sn içinde) kilit bir kez açılacak.");
        }

        var res = await locks.TriggerAsync(device, device.Direction, ct);
        return new LibraryDeviceTestResultDto(res.Opened, res.Opened ? "Kilit tetiklendi." : res.ErrorMessage ?? "Kilit tetiklenemedi.");
    }

    private async Task<string> GenerateCodeAsync(CancellationToken ct)
    {
        string code;
        do { code = $"LIB-DEV-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}"; }
        while (await uow.LibraryDevices.ExistsByCodeAsync(code, ct));
        return code;
    }

    private async Task<LibraryDevice> GetOwnedAsync(Guid id, CancellationToken ct)
    {
        var device = await uow.LibraryDevices.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Cihaz bulunamadı.", "DEVICE_NOT_FOUND");
        await EnsureInScopeAsync(device.LibraryId, ct);
        return device;
    }

    private static LibraryDeviceData ToData(CreateLibraryDeviceRequest r)
        => new(r.Name, r.Direction, r.DeviceId, r.IpAddress, r.Port ?? 0, r.Username, r.Password, r.RelayNo ?? 0, r.RelayMs ?? 0, r.WorkMode, r.HttpPath, r.TriggerLockOnSuccess, r.OperationMode, r.ToggleCooldownMinutes ?? 5);
    private static LibraryDeviceData ToData(UpdateLibraryDeviceRequest r)
        => new(r.Name, r.Direction, r.DeviceId, r.IpAddress, r.Port ?? 0, r.Username, r.Password, r.RelayNo ?? 0, r.RelayMs ?? 0, r.WorkMode, r.HttpPath, r.TriggerLockOnSuccess, r.OperationMode, r.ToggleCooldownMinutes ?? 5);

    private static LibraryDeviceDto ToDto(LibraryDevice d, bool revealApiKey = false)
        => new(d.Id, d.LibraryId, d.Name, d.Direction, d.DeviceId, d.IpAddress, d.Port, d.Username,
            !string.IsNullOrEmpty(d.Password), d.RelayNo, d.RelayMs, d.WorkMode, d.HttpPath,
            d.TriggerLockOnSuccess, d.DeviceCode, revealApiKey ? d.ApiKey : null, d.IsActive, d.CreatedAt,
            d.OperationMode, d.ToggleCooldownMinutes);

    private static object Snapshot(LibraryDevice d) => new
    {
        d.LibraryId,
        d.Name,
        d.Direction,
        d.DeviceId,
        d.IpAddress,
        d.Port,
        d.Username,
        HasPassword = !string.IsNullOrEmpty(d.Password),
        d.RelayNo,
        d.RelayMs,
        d.WorkMode,
        d.HttpPath,
        d.TriggerLockOnSuccess,
        d.OperationMode,
        d.ToggleCooldownMinutes,
        d.DeviceCode,
        d.IsActive,
    };
}
