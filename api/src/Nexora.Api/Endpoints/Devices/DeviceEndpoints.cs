using System.Text;
using Nexora.Application.Features.Devices;

namespace Nexora.Api.Endpoints.Devices;

public static class DeviceEndpoints
{
    public static IEndpointRouteBuilder MapDeviceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/device")
            .WithTags("Device")
            .AllowAnonymous()
            .RequireRateLimiting("device");

        group.MapPost("/webaccess", WebAccess).DisableAntiforgery();
        group.MapGet("/webaccess", () => Results.Ok(new { status = "ok" }));

        return app;
    }

    private static async Task<IResult> WebAccess(HttpContext http, ILiderTekWebhookService service, CancellationToken ct)
    {
        var form = await ReadFieldsAsync(http, ct);
        var key = ResolveDeviceKey(http, form);
        var response = await service.HandleAsync(form, key, ct);
        return Results.Json(response);
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
            foreach (var kv in form)
                result[kv.Key] = kv.Value.ToString();
            return result;
        }

        foreach (var kv in http.Request.Query)
            result[kv.Key] = kv.Value.ToString();

        if (http.Request.ContentLength is > 0)
        {
            using var reader = new StreamReader(http.Request.Body);
            var body = await reader.ReadToEndAsync(ct);
            if (!string.IsNullOrWhiteSpace(body) && body.TrimStart().StartsWith('{'))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(body);
                    foreach (var prop in doc.RootElement.EnumerateObject())
                        result[prop.Name] = prop.Value.ToString();
                }
                catch (System.Text.Json.JsonException) { }
            }
        }

        return result;
    }
}
