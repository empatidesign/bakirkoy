using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Domain.Entities.Libraries;
namespace Nexora.Infrastructure.Services;

public class LibraryLockController(
    IHttpClientFactory httpClientFactory,
    IConfiguration config,
    ILogger<LibraryLockController> logger) : ILibraryLockController
{
    public async Task<LibraryLockResult> TriggerAsync(LibraryDevice device, string direction, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(device.IpAddress))
        {
            logger.LogInformation("Kilit sinyali (IP yok, geçildi): device={Name} direction={Direction}", device.Name, direction);
            return LibraryLockResult.Success();
        }

        // Task 9 fix (real, reportable finding): this outbound HTTP trigger previously had NO
        // SSRF/private-target allowlist guard at all, unlike the sibling FacilityDoorController,
        // which meant a misconfigured/malicious device.IpAddress could point this real
        // HttpClient.SendAsync call at an arbitrary public host. Reuses FacilityDoorController's
        // exact guard shape and its SAME config key (DoorSecurity:AllowPublicTargets) via the
        // shared DoorSecurityGuard helper, rather than leaving this controller unguarded or
        // duplicating the private-range logic a second time.
        if (!DoorSecurityGuard.AllowPublicTargets(config) && !await DoorSecurityGuard.IsHostAllowedAsync(device.IpAddress, ct))
        {
            logger.LogWarning("Kilit: hedef adres izinli yerel ağ dışında, SSRF koruması engelledi (device={Name}, ip={Ip}).", device.Name, device.IpAddress);
            return LibraryLockResult.Failure("LOCK_TARGET_NOT_ALLOWED", "Kilit cihazının adresi izinli yerel ağ aralığında değil. Yöneticiye başvurun.");
        }

        var scheme = config.GetValue("LibraryLock:UseHttps", false) ? "https" : "http";
        var path = !string.IsNullOrWhiteSpace(device.HttpPath) ? device.HttpPath : config.GetValue("LibraryLock:CommandPath", "") ?? "";
        var bodyTemplate = config.GetValue("LibraryLock:CommandBodyTemplate", "") ?? "";
        var timeout = config.GetValue("LibraryLock:TimeoutSeconds", 3);
        var url = $"{scheme}://{device.IpAddress}:{device.Port}{path}";
        var body = bodyTemplate
            .Replace("{relayNo}", device.RelayNo.ToString())
            .Replace("{relayMs}", device.RelayMs.ToString());

        var allowHttpLan = config.GetValue("LibraryLock:AllowHttpOnPrivateNetwork", true);
        if (scheme == "http" && !string.IsNullOrWhiteSpace(device.Password) && !(allowHttpLan && DoorSecurityGuard.IsPrivateAddress(device.IpAddress)))
        {
            logger.LogWarning("Kilit: HTTP üzerinden kimlik bilgisi gönderilmeyecek (device={Name}). HTTPS gerekli.", device.Name);
            return LibraryLockResult.Failure("LOCK_INSECURE_TRANSPORT", "Kilit güvenli bağlantı (HTTPS) gerektiriyor. Cihaz yerel ağ dışında.");
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
                return LibraryLockResult.Failure("LOCK_TRIGGER_FAILED", "Kapı/kilit açılamadı. Lütfen görevliye başvurun.");
            return LibraryLockResult.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Kilit sinyali gönderilemedi: device={Name} direction={Direction}", device.Name, direction);
            return LibraryLockResult.Failure("LOCK_TRIGGER_FAILED", "Kilit ile bağlantı kurulamadı. Lütfen görevliye başvurun.");
        }
    }
}
