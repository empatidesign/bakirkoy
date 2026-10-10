using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantWheels;
using Nexora.Application.Features.ParticipantWheels.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeWheelEndpoints
{
    public static IEndpointRouteBuilder MapMeWheelEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/wheels")
            .WithTags("MeWheels")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetWheels);
        group.MapGet("/gifts", GetMyGifts);
        group.MapGet("/gifts/available", GetAvailableGifts);

        return app;
    }

    private static async Task<IResult> GetWheels(
        [AsParameters] CitizenWheelListParams p,
        IParticipantWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetWheelsAsync(p, ct)));

    private static async Task<IResult> GetMyGifts(
        [AsParameters] CitizenGiftRequestListParams p,
        IParticipantWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyGiftsAsync(p, ct)));

    private static async Task<IResult> GetAvailableGifts(
        IParticipantWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAvailableGiftsAsync(ct)));
}
