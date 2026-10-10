using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.SystemBranding;

namespace Nexora.Api.Endpoints.SystemBranding;

public static class SystemBrandingPublicEndpoints
{
    public static IEndpointRouteBuilder MapSystemBrandingPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public/system-branding")
            .WithTags("SystemBranding");

        group.MapGet("/", async (ISystemBrandingService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetAsync(ct))))
            .AllowAnonymous();

        return app;
    }
}
