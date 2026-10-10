using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelSettingsEndpoints
{
    public static IEndpointRouteBuilder MapTravelSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travel-settings")
            .WithTags("Travels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", Get).RequirePermission("travels.view");
        group.MapPut("/", Save).RequirePermission("travels.edit");

        return app;
    }

    private static async Task<IResult> Get(ITravelSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync(ct)));

    private static async Task<IResult> Save(TravelSettingsDto req, ITravelSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync(req, ct)));
}
