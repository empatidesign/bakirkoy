using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantLiveMap;

namespace Nexora.Api.Endpoints.Me;

public static class MeLiveMapEndpoints
{
    public static IEndpointRouteBuilder MapMeLiveMapEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/live-map")
            .WithTags("MeLiveMap")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetLiveMap);

        return app;
    }

    private static async Task<IResult> GetLiveMap(IParticipantLiveMapService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetLiveMapAsync(ct)));
}
