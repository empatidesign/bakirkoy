using Nexora.Api.Common;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using HealthChecks.UI.Client;

namespace Nexora.Api.Endpoints;

public static class HealthEndpoints
{
    // "Bu düzeltme canlıda mı?" sorusu için: derlemede -p:SourceRevisionId=<commit> verilir,
    // SDK bunu "1.0.0+<commit>" olarak InformationalVersion'a gömer (Dockerfile GIT_SHA build-arg).
    private static readonly string Version =
        System.Reflection.Assembly.GetEntryAssembly()?
            .GetCustomAttributes(typeof(System.Reflection.AssemblyInformationalVersionAttribute), false)
            .OfType<System.Reflection.AssemblyInformationalVersionAttribute>().FirstOrDefault()?.InformationalVersion
        ?? "unknown";

    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow, version = Version }))
            .WithTags("Health")
            .AllowAnonymous();

        app.MapGet("/health/detail", async (HealthCheckService health) =>
            {
                var report  = await health.CheckHealthAsync();
                var payload = new
                {
                    status        = report.Status.ToString(),
                    totalDuration = report.TotalDuration,
                    checks        = report.Entries.Select(e => new
                    {
                        name        = e.Key,
                        status      = e.Value.Status.ToString(),
                        description = e.Value.Description,
                        duration    = e.Value.Duration,
                        exception   = e.Value.Exception?.Message
                    })
                };
                return Results.Json(payload, statusCode: report.Status == HealthStatus.Healthy ? 200 : 503);
            })
            .WithTags("Health")
            .AllowAnonymous();

        app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        {
            Predicate      = _ => true,
            ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
        }).AllowAnonymous();

        return app;
    }
}
