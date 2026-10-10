using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels;

namespace Nexora.Api.Endpoints.Wheels;

public static class WheelSpinEndpoints
{
    public static IEndpointRouteBuilder MapWheelSpinEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/wheels/{id:guid}/spin", Spin)
            .WithTags("WheelSpin")
            .RequireAuthorization("Citizen");

        app.MapPost("/api/v1/wheels/gifts/{giftId:guid}/apply", Apply)
            .WithTags("WheelSpin")
            .RequireAuthorization("Citizen");

        return app;
    }

    private static async Task<IResult> Spin(
        Guid id,
        ISpinService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SpinAsync(id, ct)));

    private static async Task<IResult> Apply(
        Guid giftId,
        IGiftApplicationService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Created(await service.ApplyAsync(giftId, ct)));
}
