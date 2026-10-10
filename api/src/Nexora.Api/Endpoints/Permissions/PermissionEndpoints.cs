using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Permissions;

namespace Nexora.Api.Endpoints.Permissions;

public static class PermissionEndpoints
{
    public static IEndpointRouteBuilder MapPermissionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/permissions")
            .WithTags("Permissions")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/catalog", GetCatalog).RequirePermission("permissions.view");

        return app;
    }

    private static async Task<IResult> GetCatalog(IPermissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetCatalogAsync(ct)));
}
