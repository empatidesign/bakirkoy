using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.DeviceMonitor;
using Nexora.Application.Features.DeviceMonitor.Dtos;
using Nexora.Application.Features.Devices;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class LiderTekWebhookService(
    IUnitOfWork uow,
    IFacilityAttendanceService attendance,
    IRedisService redis,
    IConfiguration config,
    ICurrentUser currentUser,
    IDeviceMonitorNotifier deviceMonitor,
    IActivityLogger log) : ILiderTekWebhookService
{
    private const int MsgReadCard = 1;
    private const int MsgIAmHere = 2;
    private const int QrDataType = 3;
    private const long EmptyCard = 0x7FFFFFFFFFFFFFFF;

    private bool IsAuthorized(FacilityDevice? device, string? presentedKey)
    {
        if (device is null) return false;
        if (!string.IsNullOrWhiteSpace(presentedKey))
            return !string.IsNullOrWhiteSpace(device.ApiKey) && FixedEquals(presentedKey, device.ApiKey);
        if (!config.GetValue("Turnstile:AllowKeylessWebhook", false)) return false;

        return IsLoopback(currentUser.ConnectionIpAddress) || IpMatches(currentUser.ConnectionIpAddress, device.IpAddress);
    }

    private static bool IsLoopback(string? ip) =>
        !string.IsNullOrWhiteSpace(ip) && System.Net.IPAddress.TryParse(ip, out var parsed) && System.Net.IPAddress.IsLoopback(parsed);

    private static bool IpMatches(string? requestIp, string? deviceIp) =>
        !string.IsNullOrWhiteSpace(requestIp) && !string.IsNullOrWhiteSpace(deviceIp)
        && string.Equals(requestIp.Trim(), deviceIp.Trim(), StringComparison.OrdinalIgnoreCase);

    private static bool FixedEquals(string? a, string? b)
    {
        var ab = Encoding.UTF8.GetBytes(a ?? "");
        var bb = Encoding.UTF8.GetBytes(b ?? "");
        return ab.Length == bb.Length && CryptographicOperations.FixedTimeEquals(ab, bb);
    }

    public static string HeartbeatKey(Guid deviceId) => $"facility:device:heartbeat:{deviceId}";

    public async Task<IReadOnlyDictionary<string, object>> HandleAsync(IReadOnlyDictionary<string, string> form, string? presentedKey, CancellationToken ct)
    {
        var ev = Parse(form);
        log.LogStep(nameof(HandleAsync), new { ev.MessageType, ev.DeviceId, ev.ReaderNum, ev.DataType });

        var sessionId = ev.SessionId ?? "";
        var relay = Math.Max(1, ev.ReaderNum);

        var device = string.IsNullOrWhiteSpace(ev.DeviceId)
            ? null
            : (await uow.FacilityDevices.FindAsync(d => d.SerialNo == ev.DeviceId, ct)).FirstOrDefault();

        if (device is not null && IsAuthorized(device, presentedKey))
        {
            var heartbeatTtl = TimeSpan.FromSeconds(Math.Max(30, config.GetValue("FacilityDevice:HeartbeatTtlSeconds", 120)));
            await redis.SetAsync(HeartbeatKey(device.Id), DateTime.UtcNow, heartbeatTtl, ct);
        }

        if (device is not null && IsAuthorized(device, presentedKey)
            && await redis.TryConsumeAsync(FacilityDeviceService.ForceOpenKey(device.Id), ct))
        {
            var forceRelayMs = device.RelayMs > 0 ? device.RelayMs : config.GetValue("Turnstile:RelayMilliseconds", 1000);
            var forceLockRelay = device.RelayNo > 0 ? device.RelayNo : relay;
            return Approve(sessionId, forceLockRelay, forceRelayMs, "Kapı Açıldı", true);
        }

        if (ev.MessageType != MsgReadCard)
            return Ack(sessionId);

        if (device is null)
            return Deny(sessionId, relay, "Cihaz tanımlı değil");

        if (!IsAuthorized(device, presentedKey))
            return Deny(sessionId, relay, "Cihaz yetkisi geçersiz");

        var code = ExtractCode(ev);
        if (string.IsNullOrWhiteSpace(code))
            return Deny(sessionId, relay, "Kimlik okunamadı");

        var result = await attendance.DeviceCheckInByDeviceAsync(device, code, ct);

        var facilityName = device.FacilityId is Guid facilityId
            ? (await uow.Facilities.GetByIdAsync(facilityId, ct))?.Name
            : device.ServiceFacilityId is Guid serviceFacilityId
                ? (await uow.ServiceFacilities.GetByIdAsync(serviceFacilityId, ct))?.Name
                : null;

        var relayMs = device.RelayMs > 0 ? device.RelayMs : config.GetValue("Turnstile:RelayMilliseconds", 1000);
        var lockRelay = device.RelayNo > 0 ? device.RelayNo : relay;
        await deviceMonitor.NotifyScanAsync(new DeviceScanEventDto(
            device.Id.ToString(), device.Module, device.Direction, result.Allowed,
            result.Allowed
                ? (device.Direction == "exit" ? "Çıkış yapıldı." : "Giriş yapıldı.")
                : result.Message,
            DateTime.UtcNow, facilityName, result.ParticipantName), ct);
        return result.Allowed
            ? Approve(sessionId, lockRelay, relayMs, result.ParticipantName ?? "Hoş Geldiniz", device.TriggerLockOnSuccess)
            : Deny(sessionId, relay, result.Message);
    }


    private static LiderTekReadEvent Parse(IReadOnlyDictionary<string, string> f)
    {
        string? Get(string k) => f.TryGetValue(k, out var v) ? v : null;
        int Int(string k) => int.TryParse(Get(k), out var v) ? v : 0;
        long Long(string k) => long.TryParse(Get(k), out var v) ? v : 0;

        return new LiderTekReadEvent(
            SessionId: Get("SA"),
            MessageType: Int("MT"),
            DeviceId: Get("DI"),
            CardId: Long("CI"),
            DataType: Int("DP"),
            Data: Get("DT"),
            ReaderNum: Int("RN"));
    }

    private static string? ExtractCode(LiderTekReadEvent ev)
    {
        if (ev.DataType == QrDataType && !string.IsNullOrWhiteSpace(ev.Data))
            return ev.Data.Trim();
        if (ev.CardId > 0 && ev.CardId < EmptyCard)
            return ev.CardId.ToString();
        return null;
    }

    private static Dictionary<string, object> Ack(string sessionId)
        => new() { ["Session_Id"] = sessionId };

    private static Dictionary<string, object> Approve(string sessionId, int relay, int relayMs, string name, bool triggerLock)
    {
        var response = new Dictionary<string, object>
        {
            ["Session_Id"] = sessionId,
            ["Clear_Screen"] = "1A8A52",
            ["Draw_Icon"] = new object[] { "Ok", 40, 40, 5, "1A8A52" },
            ["Draw_Text"] = new object[] { 0, 170, Truncate(name, 24), 5, 28, "Center", "FFFFFF", "1A8A52", "UTF8" },
            ["Sound"] = new object[] { relay, 1 },
        };
        if (triggerLock)
            response["Trigger_Relay"] = new object[] { relay, relayMs };
        return response;
    }

    private static Dictionary<string, object> Deny(string sessionId, int relay, string message)
        => new()
        {
            ["Session_Id"] = sessionId,
            ["Clear_Screen"] = "C8412F",
            ["Draw_Icon"] = new object[] { "Error", 40, 40, 5, "C8412F" },
            ["Draw_Text"] = new object[] { 0, 170, Truncate(message, 28), 5, 24, "Center", "FFFFFF", "C8412F", "UTF8" },
            ["Sound"] = new object[] { relay, 2 },
        };

    private static string Truncate(string s, int max)
        => string.IsNullOrEmpty(s) || s.Length <= max ? s : s[..max];
}
