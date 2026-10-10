using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelBoardingEndpoints
{
    public static IEndpointRouteBuilder MapTravelBoardingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travels/{travelId:guid}/boarding")
            .WithTags("TravelBoarding")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/manifest", GetManifest).RequirePermission("travels.view");

        return app;
    }

    private static async Task<IResult> GetManifest(Guid travelId, ITravelBoardingService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetBoardingManifestAsync(travelId, ct)));
}
