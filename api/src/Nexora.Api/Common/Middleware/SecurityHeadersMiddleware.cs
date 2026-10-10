namespace Nexora.Api.Common.Middleware;

public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var headers = context.Response.Headers;

        if (!headers.ContainsKey("X-Content-Type-Options"))
            headers["X-Content-Type-Options"] = "nosniff";

        var path = context.Request.Path.Value ?? string.Empty;
        if (!path.StartsWith("/scalar", StringComparison.OrdinalIgnoreCase) &&
            !path.StartsWith("/openapi", StringComparison.OrdinalIgnoreCase))
        {
            if (!headers.ContainsKey("X-Frame-Options"))
                headers["X-Frame-Options"] = "DENY";
        }

        if (!headers.ContainsKey("Referrer-Policy"))
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

        if (!headers.ContainsKey("X-XSS-Protection"))
            headers["X-XSS-Protection"] = "0";

        if (!headers.ContainsKey("Permissions-Policy"))
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

        if (context.Request.IsHttps && !headers.ContainsKey("Strict-Transport-Security"))
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        await next(context);
    }
}
