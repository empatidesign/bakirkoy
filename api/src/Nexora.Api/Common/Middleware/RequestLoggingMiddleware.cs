using Microsoft.Extensions.Logging;

namespace Nexora.Api.Common.Middleware;

public class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var method = context.Request.Method;
        var path = context.Request.Path;
        var query = context.Request.QueryString;
        var isHealthCheck = path.StartsWithSegments("/health");

        if (!isHealthCheck && logger.IsEnabled(LogLevel.Debug))
        {
            logger.LogDebug("[REQUEST] {Method} {Path}{Query}", method, path, query);
        }

        await next(context);

        sw.Stop();
        var status = context.Response.StatusCode;

        if (isHealthCheck)
        {
            if (status != StatusCodes.Status200OK)
            {
                logger.LogWarning("[RESPONSE] {Method} {Path} | {Status} | {Ms}ms",
                    method, path, status, sw.ElapsedMilliseconds);
            }

            return;
        }

        if (status >= 500)
        {
            logger.LogWarning("[RESPONSE] {Method} {Path} | {Status} | {Ms}ms",
                method, path, status, sw.ElapsedMilliseconds);
        }
        else if (logger.IsEnabled(LogLevel.Debug))
        {
            logger.LogDebug("[RESPONSE] {Method} {Path} | {Status} | {Ms}ms",
                method, path, status, sw.ElapsedMilliseconds);
        }
    }
}
