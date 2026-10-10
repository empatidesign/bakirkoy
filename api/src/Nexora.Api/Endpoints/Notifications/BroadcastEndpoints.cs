using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;

namespace Nexora.Api.Endpoints.Notifications;

public static class BroadcastEndpoints
{
    public static IEndpointRouteBuilder MapBroadcastEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/notifications")
            .WithTags("Notifications")
            .RequireAuthorization("AdminOrAbove");

        group.MapPost("/broadcast", Broadcast).RequirePermission("broadcast.send");

        group.MapGet("/broadcast/targets", GetTargets).RequirePermission("broadcast.view");

        return app;
    }

    private static async Task<IResult> Broadcast(
        BroadcastRequest req,
        INotificationBroadcastService service,
        CancellationToken ct)
    {
        var result = await service.BroadcastAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static IResult GetTargets(INotificationBroadcastService service)
        => Results.Ok(ApiResponse.Ok(service.GetTargetOptions()));
}
