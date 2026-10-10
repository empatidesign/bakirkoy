using System.Text;
using FluentValidation;
using Nexora.Api.Common;
using Nexora.Infrastructure.Services;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryDeviceEndpoints
{
    public static IEndpointRouteBuilder MapLibraryDeviceEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/v1").WithTags("LibraryDevices").RequireAuthorization("AdminOrAbove");

        admin.MapGet("/libraries/{libraryId:guid}/devices", async (Guid libraryId, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByLibraryAsync(libraryId, ct)))).RequirePermission("library.view");

        admin.MapGet("/library-devices/{id:guid}", async (Guid id, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetByIdAsync(id, ct)))).RequirePermission("library.view");

        admin.MapPost("/libraries/{libraryId:guid}/devices", async (Guid libraryId, CreateLibraryDeviceRequest req, ILibraryDeviceService svc, IValidator<CreateLibraryDeviceRequest> v, CancellationToken ct) =>
        {
            var val = await v.ValidateAsync(req, ct);
            if (!val.IsValid) throw new AppValidationException(val);
            var result = await svc.CreateAsync(libraryId, req, ct);
            return Results.Created($"/api/v1/library-devices/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("library.devices");

        admin.MapPut("/library-devices/{id:guid}", async (Guid id, UpdateLibraryDeviceRequest req, ILibraryDeviceService svc, IValidator<UpdateLibraryDeviceRequest> v, CancellationToken ct) =>
        {
            var val = await v.ValidateAsync(req, ct);
            if (!val.IsValid) throw new AppValidationException(val);
            return Results.Ok(ApiResponse.Ok(await svc.UpdateAsync(id, req, ct)));
        }).RequirePermission("library.devices");

        admin.MapDelete("/library-devices/{id:guid}", async (Guid id, ILibraryDeviceService svc, CancellationToken ct) =>
        { await svc.DeleteAsync(id, ct); return Results.Ok(ApiResponse.NoContent()); }).RequirePermission("library.devices");

        admin.MapPatch("/library-devices/{id:guid}/toggle-status", async (Guid id, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStatusAsync(id, ct)))).RequirePermission("library.devices");

        admin.MapGet("/library-devices/{id:guid}/api-key", async (Guid id, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(new { apiKey = await svc.RevealApiKeyAsync(id, ct) }))).RequirePermission("library.devices");

        admin.MapPost("/library-devices/{id:guid}/rotate-key", async (Guid id, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RotateKeyAsync(id, ct)))).RequirePermission("library.devices");

        admin.MapPost("/library-devices/{id:guid}/move", async (Guid id, MoveLibraryDeviceRequest req, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.MoveToLibraryAsync(id, req.TargetLibraryId, ct)))).RequirePermission("library.devices");

        admin.MapPost("/library-devices/{id:guid}/test-lock", async (Guid id, ILibraryDeviceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.TestLockAsync(id, ct)))).RequirePermission("library.devices");

        var device = app.MapGroup("/api/v1/library-device").WithTags("LibraryDevices").AllowAnonymous().RequireRateLimiting("device");
        device.MapPost("/webaccess", WebAccess).DisableAntiforgery();
        device.MapGet("/webaccess", () => Results.Ok(new { status = "ok" }));

        app.MapPost("/", WebAccess).AllowAnonymous().RequireRateLimiting("device").DisableAntiforgery().WithTags("LibraryDevices");
        app.MapGet("/", () => Results.Ok(new { status = "ok" })).AllowAnonymous().WithTags("LibraryDevices");

        return app;
    }

    private static async Task<IResult> WebAccess(HttpContext http, ILibraryWebhookService service, ILoggerFactory lf, CancellationToken ct)
    {
        var raw = await ReadFieldsAsync(http, ct);
        var key = ResolveDeviceKey(http, raw);

        var (form, cryptoKey) = DecryptEnvelopeIfNeeded(raw);

        var logger = lf.CreateLogger("LibraryDeviceWebhook");

        if (logger.IsEnabled(LogLevel.Warning))
            logger.LogWarning("[DEVICE-REQUEST] deviceId={DeviceId} messageType={MessageType} remoteIp={RemoteIp}",
                form.TryGetValue("DI", out var di) ? di : (form.TryGetValue("Device_Id", out var di2) ? di2 : ""),
                form.TryGetValue("MT", out var mt) ? mt : (form.TryGetValue("Message_Type", out var mt2) ? mt2 : ""),
                http.Connection.RemoteIpAddress);

        var mtRaw = form.TryGetValue("MT", out var mtDiag) ? mtDiag : (form.TryGetValue("Message_Type", out var mtDiag2) ? mtDiag2 : "");
        if ((mtRaw == "2" || mtRaw == "3") && logger.IsEnabled(LogLevel.Warning))
            logger.LogWarning("[DEVICE-MT{Mt}-RAW] {Fields}", mtRaw,
                string.Join(" | ", form.Select(kv => $"{kv.Key}={MaskField(kv.Key, kv.Value)}")));

        var response = await service.HandleAsync(form, key, ct);
        var outcome = response.TryGetValue("Trigger_Relay", out _) ? "approve"
            : response.TryGetValue("Clear_Screen", out var cs) && Equals(cs, "C8412F") ? "deny"
            : "ack";
        if (logger.IsEnabled(LogLevel.Warning))
            logger.LogWarning("[DEVICE-RESPONSE] outcome={Outcome} sessionId={SessionId}",
                outcome, response.TryGetValue("Session_Id", out var sid) ? sid : "");

        if (cryptoKey is not null)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(response);
            var encrypted = LiderTekCrypto.EncryptText(json, cryptoKey);
            var replyContentType = (http.Request.ContentType ?? "").ToLowerInvariant().Contains("json")
                ? "application/json"
                : "text/plain";
            return Results.Text(encrypted, replyContentType);
        }
        return Results.Json(response);
    }

    private static (IReadOnlyDictionary<string, string> Form, byte[]? CryptoKey) DecryptEnvelopeIfNeeded(IReadOnlyDictionary<string, string> raw)
    {
        if (!raw.TryGetValue("Data", out var envelope) || string.IsNullOrWhiteSpace(envelope)
            || !raw.TryGetValue("Device_Id", out var devIdStr) || !long.TryParse(devIdStr, out var deviceId))
            return (raw, null);

        var key = LiderTekCrypto.DeriveKeyFromDeviceId(deviceId);
        var plain = LiderTekCrypto.DecryptToText(envelope, key);
        if (plain is null) return (raw, null);

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(plain);
            var form = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in doc.RootElement.EnumerateObject())
                form[p.Name] = p.Value.ToString();
            return (form, key);
        }
        catch (System.Text.Json.JsonException)
        {
            return (raw, null);
        }
    }

    private static string ResolveDeviceKey(HttpContext http, IReadOnlyDictionary<string, string> form)
    {
        var header = http.Request.Headers["X-Device-Key"].ToString();
        if (!string.IsNullOrWhiteSpace(header)) return header;
        var basic = ReadBasicAuthPassword(http.Request.Headers["Authorization"].ToString());
        if (!string.IsNullOrWhiteSpace(basic)) return basic;
        var query = http.Request.Query["key"].ToString();
        if (!string.IsNullOrWhiteSpace(query)) return query;
        return form.TryGetValue("key", out var formKey) ? formKey : "";
    }

    private static string MaskField(string name, string value)
    {
        var lower = name.ToLowerInvariant();
        if (lower.Contains("key") || lower.Contains("password") || lower.Contains("secret") || lower.Contains("pass") || lower.Contains("auth"))
            return "***";
        return value;
    }

    private static string? ReadBasicAuthPassword(string authorization)
    {
        if (string.IsNullOrWhiteSpace(authorization) || !authorization.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
            return null;
        try
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(authorization["Basic ".Length..].Trim()));
            var sep = decoded.IndexOf(':');
            return sep >= 0 ? decoded[(sep + 1)..] : null;
        }
        catch (FormatException) { return null; }
    }

    private static async Task<IReadOnlyDictionary<string, string>> ReadFieldsAsync(HttpContext http, CancellationToken ct)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (http.Request.HasFormContentType)
        {
            var form = await http.Request.ReadFormAsync(ct);
            foreach (var kv in form) result[kv.Key] = kv.Value.ToString();
            return result;
        }
        foreach (var kv in http.Request.Query) result[kv.Key] = kv.Value.ToString();
        if (http.Request.ContentLength is > 0)
        {
            using var reader = new StreamReader(http.Request.Body);
            var body = await reader.ReadToEndAsync(ct);
            if (!string.IsNullOrWhiteSpace(body) && body.TrimStart().StartsWith('{'))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(body);
                    foreach (var p in doc.RootElement.EnumerateObject()) result[p.Name] = p.Value.ToString();
                }
                catch (System.Text.Json.JsonException) { }
            }
        }
        return result;
    }
}
