using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.NotificationPreferences;
using Nexora.Application.Features.NotificationPreferences.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeNotificationPreferenceEndpoints
{
    public static IEndpointRouteBuilder MapMeNotificationPreferenceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/notification-preferences")
            .WithTags("MeNotificationPreferences")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList);
        group.MapPut("/", Upsert);
        group.MapPost("/opt-out-all", OptOutAll);

        return app;
    }

    private static async Task<IResult> GetList(
        ICurrentUser currentUser, INotificationPreferenceService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        var result = await service.GetPreferencesAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Upsert(
        UpsertNotificationPreferenceRequest req,
        ICurrentUser currentUser, INotificationPreferenceService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        var result = await service.UpsertPreferenceAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> OptOutAll(
        ICurrentUser currentUser, INotificationPreferenceService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        await service.OptOutAllAsync(participantId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static Guid RequireParticipant(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
}
