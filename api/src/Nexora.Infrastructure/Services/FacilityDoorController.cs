using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services;

public class FacilityDoorController(
    IHttpClientFactory httpClientFactory,
    IConfiguration config,
    ILogger<FacilityDoorController> logger) : IFacilityDoorController
{
    public async Task<FacilityDoorTriggerResult> TriggerAsync(FacilityDoorTriggerRequest request, CancellationToken ct = default)
    {
        if (!request.TriggerLockOnSuccess)
            return FacilityDoorTriggerResult.Success();

        if (!string.IsNullOrWhiteSpace(request.IpAddress))
            return await TriggerLockAsync(request, ct);

        if (!string.IsNullOrWhiteSpace(request.WebhookUrl))
            return await TriggerWebhookAsync(request, ct);

        logger.LogInformation(
            "Kapı sinyali (yerel sürücü yok, geçildi): device={DeviceName} direction={Direction}",
            request.DeviceName, request.Direction);
        return FacilityDoorTriggerResult.Success();
    }

    private async Task<FacilityDoorTriggerResult> TriggerLockAsync(FacilityDoorTriggerRequest device, CancellationToken ct)
    {
        if (!DoorSecurityGuard.AllowPublicTargets(config) && !await DoorSecurityGuard.IsHostAllowedAsync(device.IpAddress, ct))
        {
            logger.LogWarning("Kilit: hedef adres izinli yerel ağ dışında, SSRF koruması engelledi (device={Name}, ip={Ip}).", device.DeviceName, device.IpAddress);
            return FacilityDoorTriggerResult.Failure("LOCK_TARGET_NOT_ALLOWED", "Kilit cihazının adresi izinli yerel ağ aralığında değil. Yöneticiye başvurun.");
        }

        var scheme = config.GetValue("LibraryLock:UseHttps", false) ? "https" : "http";
        var path = !string.IsNullOrWhiteSpace(device.HttpPath) ? device.HttpPath : config.GetValue("LibraryLock:CommandPath", "") ?? "";
        var bodyTemplate = config.GetValue("LibraryLock:CommandBodyTemplate", "") ?? "";
        var timeout = config.GetValue("LibraryLock:TimeoutSeconds", 3);
        var url = $"{scheme}://{device.IpAddress}:{device.Port}{path}";
        var body = bodyTemplate
            .Replace("{relayNo}", device.RelayNo.ToString())
            .Replace("{relayMs}", device.RelayMs.ToString());

        if (string.IsNullOrWhiteSpace(bodyTemplate) && string.IsNullOrWhiteSpace(path))
            logger.LogWarning(
                "Kilit: push cihazı (device={Name}, ip={Ip}) için LibraryLock:CommandBodyTemplate/CommandPath tanımlı değil. " +
                "Fiziksel kilit anlamlı komut almayabilir; röle kartı formatına göre şablonu yapılandırın.",
                device.DeviceName, device.IpAddress);

        var allowHttpLan = config.GetValue("LibraryLock:AllowHttpOnPrivateNetwork", true);
        if (scheme == "http" && !string.IsNullOrWhiteSpace(device.Password) && !(allowHttpLan && DoorSecurityGuard.IsPrivateAddress(device.IpAddress)))
        {
            logger.LogWarning("Kilit: HTTP üzerinden kimlik bilgisi gönderilmeyecek (device={Name}). HTTPS gerekli.", device.DeviceName);
            return FacilityDoorTriggerResult.Failure("LOCK_INSECURE_TRANSPORT", "Kilit güvenli bağlantı (HTTPS) gerektiriyor. Cihaz yerel ağ dışında.");
        }

        try
        {
            using var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(Math.Max(1, timeout));
            using var msg = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            };
            if (!string.IsNullOrWhiteSpace(device.Username))
            {
                var token = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{device.Username}:{device.Password}"));
                msg.Headers.Authorization = new AuthenticationHeaderValue("Basic", token);
            }
            var response = await client.SendAsync(msg, ct);
            if (!response.IsSuccessStatusCode)
                return FacilityDoorTriggerResult.Failure("LOCK_TRIGGER_FAILED", "Kapı/kilit açılamadı. Lütfen görevliye başvurun.");
            return FacilityDoorTriggerResult.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Kilit sinyali gönderilemedi: device={Name} direction={Direction}", device.DeviceName, device.Direction);
            return FacilityDoorTriggerResult.Failure("LOCK_TRIGGER_FAILED", "Kilit ile bağlantı kurulamadı. Lütfen görevliye başvurun.");
        }
    }

    private async Task<FacilityDoorTriggerResult> TriggerWebhookAsync(FacilityDoorTriggerRequest request, CancellationToken ct)
    {
        if (!DoorSecurityGuard.AllowPublicTargets(config))
        {
            if (!Uri.TryCreate(request.WebhookUrl, UriKind.Absolute, out var webhookUri)
                || (webhookUri.Scheme != Uri.UriSchemeHttp && webhookUri.Scheme != Uri.UriSchemeHttps)
                || !await DoorSecurityGuard.IsHostAllowedAsync(webhookUri.Host, ct))
            {
                logger.LogWarning("Kapı webhook: hedef URL izinli yerel ağ dışında/geçersiz, SSRF koruması engelledi (device={Name}).", request.DeviceName);
                return FacilityDoorTriggerResult.Failure("DOOR_TARGET_NOT_ALLOWED", "Turnike webhook adresi izinli yerel ağ aralığında değil. Yöneticiye başvurun.");
            }
        }

        var timeout = config.GetValue("Turnstile:DoorTimeoutSeconds", 5);
        try
        {
            using var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(Math.Max(1, timeout));
            var payload = JsonSerializer.Serialize(new
            {
                deviceId = request.DeviceId,
                direction = request.Direction,
                relayMilliseconds = request.RelayMs,
            });
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(request.WebhookUrl, content, ct);
            if (!response.IsSuccessStatusCode)
                return FacilityDoorTriggerResult.Failure("DOOR_TRIGGER_FAILED", "Turnike açılamadı. Lütfen görevliye başvurun.");
            return FacilityDoorTriggerResult.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Kapı webhook sinyali gönderilemedi: device={Name}", request.DeviceName);
            return FacilityDoorTriggerResult.Failure("DOOR_TRIGGER_FAILED", "Turnike ile bağlantı kurulamadı. Lütfen görevliye başvurun.");
        }
    }

}
