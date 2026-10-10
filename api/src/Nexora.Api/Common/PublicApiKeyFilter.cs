using Microsoft.Extensions.Configuration;

namespace Nexora.Api.Common;

public sealed class PublicApiKeyFilter(IConfiguration config) : IEndpointFilter
{
    private const string HeaderName = "X-Api-Key";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var enabled = config.GetValue("PublicApi:Enabled", true);
        if (!enabled)
            return Results.Json(Nexora.Application.Common.ApiResponse.ApiResponse.Fail(StatusCodes.Status503ServiceUnavailable, "Public API kapalı.", "SERVICE_UNAVAILABLE"), statusCode: StatusCodes.Status503ServiceUnavailable);

        var requireKey = config.GetValue("PublicApi:RequireApiKey", true);
        if (requireKey)
        {
            var keys = config.GetSection("PublicApi:ApiKeys").Get<string[]>() ?? [];
            var provided = context.HttpContext.Request.Headers[HeaderName].ToString();
            if (string.IsNullOrWhiteSpace(provided) || keys.Length == 0 || !keys.Any(k => FixedEquals(k, provided)))
                return Results.Json(Nexora.Application.Common.ApiResponse.ApiResponse.Fail(StatusCodes.Status401Unauthorized, "Geçersiz veya eksik API anahtarı.", "UNAUTHORIZED"), statusCode: StatusCodes.Status401Unauthorized);
        }

        return await next(context);
    }

    private static bool FixedEquals(string? a, string? b)
    {
        if (a is null || b is null) return false;
        var ab = System.Text.Encoding.UTF8.GetBytes(a);
        var bb = System.Text.Encoding.UTF8.GetBytes(b);
        return ab.Length == bb.Length && System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(ab, bb);
    }
}
