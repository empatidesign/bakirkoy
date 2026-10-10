using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.AppMenu;

namespace Nexora.Api.Endpoints.AppMenu;

public static class AppMenuPublicEndpoints
{
    public static IEndpointRouteBuilder MapAppMenuPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public/app-menu")
            .WithTags("AppMenu");

        group.MapGet("/", async (IAppMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetPublicMenuAsync(ct))));

        group.MapGet("/modules", async (IAppMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetSystemModulesAsync(ct))));

        return app;
    }
}
