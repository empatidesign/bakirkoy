using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services;

public class LibraryDoorController(
    IHttpClientFactory httpClientFactory,
    IConfiguration config,
    ILogger<LibraryDoorController> logger) : IDoorController
{
    private string? WebhookUrl => config["LibraryDoor:WebhookUrl"];
    private int TimeoutSeconds => config.GetValue("LibraryDoor:TimeoutSeconds", 5);

    public async Task<DoorTriggerResult> TriggerAsync(DoorTriggerRequest request, CancellationToken ct = default)
    {
        var url = WebhookUrl;
        if (string.IsNullOrWhiteSpace(url))
        {
            logger.LogInformation(
                "Kapı sinyali (yapılandırılmış sürücü yok, geçildi): library={LibraryId} kind={Kind} direction={Direction} member={Member}",
                request.LibraryId, request.DeviceKind, request.Direction, request.MemberName);
            return DoorTriggerResult.Success();
        }

        try
        {
            using var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(Math.Max(1, TimeoutSeconds));
            var payload = JsonSerializer.Serialize(new
            {
                libraryId = request.LibraryId,
                deviceKind = request.DeviceKind,
                direction = request.Direction,
                sessionId = request.SessionId,
            });
            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(url, content, ct);
            if (!response.IsSuccessStatusCode)
                return DoorTriggerResult.Failure("DOOR_TRIGGER_FAILED", "Kapı/turnike açılamadı. Lütfen görevliye başvurun.");
            return DoorTriggerResult.Success();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Kapı sinyali gönderilemedi: library={LibraryId} direction={Direction}", request.LibraryId, request.Direction);
            return DoorTriggerResult.Failure("DOOR_TRIGGER_FAILED", "Kapı/turnike ile bağlantı kurulamadı. Lütfen görevliye başvurun.");
        }
    }
}
