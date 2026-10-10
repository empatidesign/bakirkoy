using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Presence;
using Nexora.Application.Features.Presence.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MePresenceEndpoints
{
    public static IEndpointRouteBuilder MapMePresenceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/presence")
            .WithTags("MePresence")
            .RequireAuthorization("AdminOrAbove");

        group.MapPost("/heartbeat", Heartbeat);
        group.MapGet("/online", GetOnline);
        group.MapPost("/broadcast", Broadcast);

        return app;
    }

    private static async Task<IResult> Heartbeat(
        PresenceHeartbeatRequest? request, ICurrentUser currentUser, IPresenceService service, CancellationToken ct)
    {
        await service.HeartbeatAsync(RequireUser(currentUser), request?.Device, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetOnline(
        ICurrentUser currentUser, IPresenceService service, CancellationToken ct)
    {
        var result = await service.GetOnlineVisibleAsync(RequireUser(currentUser), ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Broadcast(
        PresenceBroadcastRequest request, ICurrentUser currentUser, IPresenceService service, CancellationToken ct)
    {
        var result = await service.BroadcastAsync(RequireUser(currentUser), request, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static Guid RequireUser(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
}
