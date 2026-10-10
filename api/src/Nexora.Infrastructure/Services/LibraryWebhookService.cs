using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Extensions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.DeviceMonitor;
using Nexora.Application.Features.DeviceMonitor.Dtos;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Application.Features.LibraryStaffIdentity;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Services;

public class LibraryWebhookService(
    IUnitOfWork uow,
    ILibraryOperationsService ops,
    ILibraryShiftService shifts,
    IRedisService redis,
    IConfiguration config,
    ICurrentUser currentUser,
    IDeviceMonitorNotifier deviceMonitor,
    IStaffIdentityQrService staffQr,
    ICitizenIdentityQrService cidQr,
    ILibrarySessionRealtimeNotifier realtime,
    IActivityLogger log,
    Microsoft.Extensions.Logging.ILogger<LibraryWebhookService> logger) : ILibraryWebhookService
{
    private bool IsAuthorized(LibraryDevice? device, string? presentedKey)
    {
        if (device is null) return false;
        if (!string.IsNullOrWhiteSpace(presentedKey))
            return !string.IsNullOrWhiteSpace(device.ApiKey) && FixedEquals(presentedKey, device.ApiKey);
        if (!config.GetValue("LibraryDevice:AllowKeylessWebhook", false)) return false;

        return IsLoopback(currentUser.ConnectionIpAddress) || IpMatches(currentUser.ConnectionIpAddress, device.IpAddress);
    }

    private static bool IsLoopback(string? ip) =>
        !string.IsNullOrWhiteSpace(ip) && System.Net.IPAddress.TryParse(ip, out var parsed) && System.Net.IPAddress.IsLoopback(parsed);

    private static bool IpMatches(string? requestIp, string? deviceIp) =>
        !string.IsNullOrWhiteSpace(requestIp) && !string.IsNullOrWhiteSpace(deviceIp)
        && string.Equals(requestIp.Trim(), deviceIp.Trim(), StringComparison.OrdinalIgnoreCase);
    public static string HeartbeatKey(Guid deviceId) => $"library:device:heartbeat:{deviceId}";

    public async Task<IReadOnlyDictionary<string, object>> HandleAsync(IReadOnlyDictionary<string, string> form, string? presentedKey, CancellationToken ct)
    {
        string? Get(params string[] keys)
        {
            foreach (var k in keys)
                if (form.TryGetValue(k, out var v) && !string.IsNullOrWhiteSpace(v)) return v;
            return null;
        }
        int Int(params string[] keys) => int.TryParse(Get(keys), out var v) ? v : 0;

        var sessionId = Get("SA", "Session_Id") ?? "";
        var relay = Math.Max(1, Int("RN", "Relay_No"));
        var deviceId = Get("DI", "Device_Id");
        var data = Get("DT", "Data");
        var hasReadData = !string.IsNullOrWhiteSpace(data);
        var messageType = Int("MT", "Message_Type");

        log.LogStep(nameof(HandleAsync), new { deviceId, relay, hasReadData, messageType });

        var device = string.IsNullOrWhiteSpace(deviceId) ? null : await uow.LibraryDevices.GetByDeviceIdAsync(deviceId, ct);
        var authorized = IsAuthorized(device, presentedKey);

        var library = device is null ? null : await uow.Libraries.GetByIdAsync(device.LibraryId, ct);
        if (device is not null && authorized)
        {
            var ttl = TimeSpan.FromSeconds(Math.Max(30, config.GetValue("LibraryDevice:HeartbeatTtlSeconds", 120)));
            await redis.SetAsync(HeartbeatKey(device.Id), DateTime.UtcNow, ttl, ct);
        }

        if (authorized && await redis.TryConsumeAsync(LibraryDeviceService.ForceOpenKey(device!.Id), ct))
        {
            var testRelay = device.RelayNo > 0 ? device.RelayNo : relay;
            return Approve(sessionId, relay, "Test: Kapı Açıldı", device.TriggerLockOnSuccess, testRelay, device.RelayMs);
        }

        if (!hasReadData)
            return Ack(sessionId, deviceId);

        if (device is null) return Deny(sessionId, relay, "Cihaz tanımlı değil");
        if (!authorized) return Deny(sessionId, relay, "Cihaz yetkisi geçersiz");

        var (complete, assembled) = await AccumulateFragmentAsync(device.Id, data!, ct);
        if (!complete)
            return Ack(sessionId, deviceId);

        var code = assembled.Trim();

        if (LooksLikeStaffCode(code))
        {
            var (staffVerified, staffId) = await staffQr.TryVerifyAsync(code, ct);
            if (staffVerified)
                return await HandleStaffDoorAsync(device, library, sessionId, relay, staffId, ct);
        }

        var (citizenVerified, participantId) = await cidQr.TryVerifyAsync(code, ct);
        if (citizenVerified)
        {
            var participantStaff = await uow.LibraryStaff.GetByParticipantAsync(participantId, ct);
            if (participantStaff is { IsActive: true } &&
                (participantStaff.AdminUserId is not null || participantStaff.HasDoorAccess))
                return await HandleParticipantStaffDoorAsync(device, library, sessionId, relay, participantStaff, ct);
        }

        var action = device.OperationMode == "toggle" ? "toggle" : (device.Direction == "exit" ? "exit" : "entry");
        LibraryScanResultDto result;
        try
        {
            result = await ops.ScanAccessAsync(device.LibraryId, code, action, device.ToggleCooldownMinutes, ct);
        }
        catch (Nexora.Application.Common.Exceptions.ConflictException cex)
        {
            log.LogStepError(nameof(HandleAsync), cex);
            if (cex.ErrorCode == "INVALID_QR")
                logger.LogWarning("[DEVICE-INVALID-QR] kind={Kind} length={Length}", CodeKind(code), code.Length);
            var denyMessage = ScreenMessageFor(cex.ErrorCode, cex.Message);
            await NotifyScanAsync(device, library?.Name, action, false, denyMessage, null, ct);
            NotifyCitizenDenied(citizenVerified, participantId, device, action, cex.Message);
            return Deny(sessionId, relay, denyMessage);
        }
        catch (Exception ex)
        {
            log.LogStepError(nameof(HandleAsync), ex);
            await NotifyScanAsync(device, library?.Name, action, false, "Yetkiniz yok veya kayıt bulunamadı", null, ct);
            NotifyCitizenDenied(citizenVerified, participantId, device, action, "Yetkiniz yok veya kayıt bulunamadı");
            return Deny(sessionId, relay, "Yetkiniz yok veya kayıt bulunamadı");
        }

        var name = string.IsNullOrWhiteSpace(result.Message) ? (action == "exit" ? "Güle Güle" : "Hoş Geldiniz") : result.Message;
        var lockRelay = device.RelayNo > 0 ? device.RelayNo : relay;
        await NotifyScanAsync(device, library?.Name, action, true, name, result.ParticipantName, ct);
        return Approve(sessionId, relay, name, device.TriggerLockOnSuccess, lockRelay, device.RelayMs);
    }

    private void NotifyCitizenDenied(bool citizenVerified, Guid participantId, LibraryDevice device, string action, string message)
    {
        if (!citizenVerified) return;
        _ = realtime.NotifyScanDeniedAsync(participantId,
            new LibraryScanDeniedEvent(device.Direction, device.LibraryId, message, DateTime.UtcNow), CancellationToken.None);
    }

    private Task NotifyScanAsync(LibraryDevice device, string? libraryName, string action, bool success, string message, string? personName, CancellationToken ct)
        => deviceMonitor.NotifyScanAsync(new DeviceScanEventDto(
            device.Id.ToString(), "library", action, success, message, DateTime.UtcNow, libraryName, personName), ct);

    private static string CodeKind(string code) =>
        code.StartsWith("nxr-cid_", StringComparison.Ordinal) ? "cid-token"
        : code.StartsWith("nxr-staff_", StringComparison.Ordinal) ? "staff-token"
        : code.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? (code.Contains("/qr-giris/") ? "static-library-url" : "url")
        : code.Length == 10 ? "short-code"
        : "unknown";

    private static bool LooksLikeStaffCode(string code) =>
        code.StartsWith("nxr-staff_", StringComparison.Ordinal) || code.Length == 10;

    private async Task<IReadOnlyDictionary<string, object>> HandleStaffDoorAsync(
        LibraryDevice device, Domain.Entities.Libraries.Library? library, string sessionId, int relay, Guid staffId, CancellationToken ct)
    {
        var staff = await uow.LibraryStaff.GetByIdAsync(staffId, ct);
        var hasAccess = staff is { IsActive: true, AdminUserId: Guid adminId }
            && await uow.HasPermissionAsync(adminId, "library-mesai.door-access", ct);
        if (!hasAccess)
        {
            log.LogStep(nameof(HandleStaffDoorAsync), new { staffId, denied = "no-door-access-permission" });
            await NotifyScanAsync(device, library?.Name, "staff-door", false, "Kapı açma yetkiniz yok", null, ct);
            return Deny(sessionId, relay, "Kapı açma yetkiniz yok");
        }

        return await ToggleAndRespondAsync(device, library, sessionId, relay, staffId, ct);
    }

    private async Task<IReadOnlyDictionary<string, object>> HandleParticipantStaffDoorAsync(
        LibraryDevice device, Domain.Entities.Libraries.Library? library, string sessionId, int relay, LibraryStaff staff, CancellationToken ct)
    {
        var hasAccess = staff.AdminUserId is Guid adminId
            ? await uow.HasPermissionAsync(adminId, "library-mesai.door-access", ct)
            : staff.HasDoorAccess;
        if (!hasAccess)
            return Deny(sessionId, relay, "Kapı açma yetkiniz yok");

        return await ToggleAndRespondAsync(device, library, sessionId, relay, staff.Id, ct);
    }

    private async Task<IReadOnlyDictionary<string, object>> ToggleAndRespondAsync(
        LibraryDevice device, Domain.Entities.Libraries.Library? library, string sessionId, int relay, Guid staffId, CancellationToken ct)
    {
        DoorQrToggleResultDto toggleResult;
        try
        {
            toggleResult = await shifts.ToggleDoorQrAsync(staffId, device.LibraryId, ct);
        }
        catch (Nexora.Application.Common.Exceptions.ConflictException cex)
        {
            log.LogStepError(nameof(ToggleAndRespondAsync), cex);
            await NotifyScanAsync(device, library?.Name, "staff-door", false, ScreenMessageFor(cex.ErrorCode, cex.Message), null, ct);
            return Deny(sessionId, relay, ScreenMessageFor(cex.ErrorCode, cex.Message));
        }
        catch (Nexora.Application.Common.Exceptions.NotFoundException nex)
        {
            log.LogStepError(nameof(ToggleAndRespondAsync), nex);
            await NotifyScanAsync(device, library?.Name, "staff-door", false, "Personel kaydı bulunamadı", null, ct);
            return Deny(sessionId, relay, "Personel kaydı bulunamadı");
        }

        var lockRelay = device.RelayNo > 0 ? device.RelayNo : relay;
        await NotifyScanAsync(device, library?.Name, toggleResult.Entered ? "staff-entry" : "staff-exit", true, toggleResult.Message, toggleResult.StaffName, ct);
        return Approve(sessionId, relay, toggleResult.Message, device.TriggerLockOnSuccess, lockRelay, device.RelayMs);
    }

    private static string FragmentBufferKey(Guid deviceId) => $"library-device:qr-fragment:{deviceId}";

    private int FragmentWindowSeconds => config.GetValue("LibraryDevice:QrFragmentWindowSeconds", 5);

    private async Task<(bool Complete, string Data)> AccumulateFragmentAsync(Guid deviceId, string fragment, CancellationToken ct)
    {
        var terminated = fragment.EndsWith('\r') || fragment.EndsWith("%0D", StringComparison.OrdinalIgnoreCase);
        var clean = SanitizeFragment(fragment);

        var key = FragmentBufferKey(deviceId);
        var existing = await redis.GetAsync<string>(key, ct) ?? "";

        var prefixIdx = clean.IndexOf("nxr-cid_", StringComparison.Ordinal);
        if (prefixIdx > 0) clean = clean[prefixIdx..];
        var combined = prefixIdx >= 0 ? clean : existing + clean;

        if (!terminated)
        {
            await redis.SetAsync(key, combined, TimeSpan.FromSeconds(FragmentWindowSeconds), ct);
            return (false, "");
        }

        await redis.RemoveAsync(key, ct);
        return (true, combined);
    }

    private static string SanitizeFragment(string fragment)
    {
        var s = fragment
            .Replace("%00", "", StringComparison.OrdinalIgnoreCase)
            .Replace("%0D", "", StringComparison.OrdinalIgnoreCase)
            .Replace("%0A", "", StringComparison.OrdinalIgnoreCase);
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
            if (!char.IsControl(ch)) sb.Append(ch);
        return sb.ToString();
    }

    private static readonly Dictionary<string, string> ScreenMessages = new()
    {
        ["DAILY_VISIT_CAP_REACHED"] = "Günlük hakkınız doldu",
        ["INVALID_QR"] = "QR okunamadı, yenileyin",
        ["LIBRARY_INACTIVE"] = "Şu an kapalı",
        ["ACTIVE_SESSION_EXISTS"] = "Zaten içeridesiniz",        ["ACTIVE_SESSION_ELSEWHERE"] = "Başka yerde oturum açık",
        ["SEAT_REQUIRED"] = "Önce koltuk seçin",
        ["NO_ENTRY_RIGHT"] = "Giriş hakkınız yok",
        ["NO_ACTIVE_SESSION"] = "Aktif oturum yok",
        ["EXIT_INTENT_REQUIRED"] = "Önce uygulamadan çıkın",
        ["EXIT_INTENT_EXPIRED"] = "Süre doldu",
        ["NO_ACTIVE_BREAK"] = "Molada değilsiniz",
        ["LIBRARY_FULL"] = "Kıraathane dolu",
        ["SEAT_ALREADY_TAKEN"] = "Koltuk dolu",
        ["BREAK_SYSTEM_DISABLED"] = "Mola sistemi kapalı",
        ["TOO_SOON_FOR_BREAK"] = "Henüz mola veremezsiniz",
        ["TOGGLE_COOLDOWN_ACTIVE"] = "Az sonra deneyin",
        ["BREAK_LIMIT_REACHED"] = "Mola hakkınız bitti",
        ["LONG_BREAK_LIMIT"] = "Uzun mola hakkı bitti",
        ["BREAK_TOO_SOON"] = "Mola arası dolmadı",
        ["NOT_INSIDE"] = "İçeride değilsiniz",
        ["BREAK_ALREADY_ENDED"] = "Mola zaten bitti",
        ["ALREADY_EXITED"] = "Zaten çıktınız",
        ["INVALID_ACTION"] = "Geçersiz işlem",
        ["DOOR_TRIGGER_FAILED"] = "Kapı açılamadı",
        ["LIBRARY_FULL_JOIN_QUEUE"] = "Dolu, sıraya girin",
    };

    private static string ScreenMessageFor(string errorCode, string fallbackMessage) =>
        ScreenMessages.TryGetValue(errorCode, out var msg) ? msg : TruncAtWordUtf8Safe(fallbackMessage, 28);

    private static string TruncAtWordUtf8Safe(string s, int maxBytes)
    {
        if (string.IsNullOrEmpty(s)) return s;
        if (Encoding.UTF8.GetByteCount(s) <= maxBytes) return s;

        var sb = new StringBuilder();
        var byteCount = 0;
        foreach (var ch in s)
        {
            var chByteCount = Encoding.UTF8.GetByteCount(new[] { ch });
            if (byteCount + chByteCount > maxBytes) break;
            sb.Append(ch);
            byteCount += chByteCount;
        }
        var cut = sb.ToString();

        var lastSpace = cut.LastIndexOf(' ');
        return lastSpace > 8 ? cut[..lastSpace] : cut;
    }


    private static Dictionary<string, object> Ack(string s, string? deviceId) => new()
    {
        ["Session_Id"] = s,
    };

    private static Dictionary<string, object> Approve(string s, int relay, string name, bool triggerLock, int lockRelay, int relayMs)
    {
        var response = new Dictionary<string, object>
        {
            ["Session_Id"] = s,
            ["Clear_Screen"] = "1A8A52",
            ["Draw_Icon"] = new object[] { "Ok", 40, 40, 5, "1A8A52" },
            ["Draw_Text"] = new object[] { 0, 170, Trunc(name, 24), 5, 28, "Center", "FFFFFF", "1A8A52", "UTF8" },
        };
        if (triggerLock)
            response["Trigger_Relay"] = new object[] { lockRelay, relayMs };
        return response;
    }

    private static Dictionary<string, object> Deny(string s, int relay, string message) => new()
    {
        ["Session_Id"] = s,
        ["Clear_Screen"] = "C8412F",
        ["Draw_Icon"] = new object[] { "Error", 40, 40, 5, "C8412F" },
        ["Draw_Text"] = new object[] { 0, 170, Trunc(message, 28), 5, 24, "Center", "FFFFFF", "C8412F", "UTF8" },
    };

    private static string Trunc(string s, int maxBytes)
    {
        if (string.IsNullOrEmpty(s)) return s;
        if (Encoding.UTF8.GetByteCount(s) <= maxBytes) return s;
        var sb = new StringBuilder();
        var byteCount = 0;
        foreach (var ch in s)
        {
            var chByteCount = Encoding.UTF8.GetByteCount(new[] { ch });
            if (byteCount + chByteCount > maxBytes) break;
            sb.Append(ch);
            byteCount += chByteCount;
        }
        return sb.ToString();
    }

    private static bool FixedEquals(string? a, string? b)
    {
        var ab = Encoding.UTF8.GetBytes(a ?? "");
        var bb = Encoding.UTF8.GetBytes(b ?? "");
        return ab.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ab, bb);
    }
}
