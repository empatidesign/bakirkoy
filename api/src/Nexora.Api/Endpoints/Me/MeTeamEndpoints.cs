using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Team;
using Nexora.Application.Features.Team.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeTeamEndpoints
{
    public static IEndpointRouteBuilder MapMeTeamEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/team")
            .WithTags("MeTeam")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/members", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetVisibleMembersAsync(Uid(u), ct))));
        group.MapGet("/subordinates", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetSubordinatesAsync(Uid(u), ct))));

        group.MapGet("/notes", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetNotesAsync(Uid(u), ct))));
        group.MapPost("/notes", async (CreateTeamNoteRequest r, ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Created(await s.CreateNoteAsync(Uid(u), r, ct))));
        group.MapPut("/notes/{id:guid}", async (Guid id, UpdateTeamNoteRequest r, ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.UpdateNoteAsync(Uid(u), id, r, ct))));
        group.MapPatch("/notes/{id:guid}/pin", async (Guid id, ICurrentUser u, ITeamService s, CancellationToken ct) =>
        {
            await s.TogglePinNoteAsync(Uid(u), id, ct);
            return Results.Ok(ApiResponse.NoContent());
        });
        group.MapDelete("/notes/{id:guid}", async (Guid id, ICurrentUser u, ITeamService s, CancellationToken ct) =>
        {
            await s.DeleteNoteAsync(Uid(u), id, ct);
            return Results.Ok(ApiResponse.NoContent());
        });

        group.MapGet("/tasks", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetTasksAsync(Uid(u), ct))));
        group.MapPost("/tasks", async (CreateTeamTaskRequest r, ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Created(await s.CreateTaskAsync(Uid(u), r, ct))));
        group.MapPatch("/tasks/{id:guid}/status", async (Guid id, bool done, ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.SetTaskStatusAsync(Uid(u), id, done, ct))));
        group.MapDelete("/tasks/{id:guid}", async (Guid id, ICurrentUser u, ITeamService s, CancellationToken ct) =>
        {
            await s.DeleteTaskAsync(Uid(u), id, ct);
            return Results.Ok(ApiResponse.NoContent());
        });

        group.MapGet("/messages/{otherId:guid}", async (Guid otherId, ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetThreadAsync(Uid(u), otherId, ct))));
        group.MapPost("/messages", async (SendTeamMessageRequest r, ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Created(await s.SendMessageAsync(Uid(u), r, ct))));
        group.MapGet("/messages-unread", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetUnreadSummaryAsync(Uid(u), ct))));
        group.MapPost("/messages/{otherId:guid}/read", async (Guid otherId, ICurrentUser u, ITeamService s, CancellationToken ct) =>
        {
            await s.MarkThreadReadAsync(Uid(u), otherId, ct);
            return Results.Ok(ApiResponse.NoContent());
        });

        group.MapGet("/notifications", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(await s.GetMyNotificationsAsync(Uid(u), ct))));
        group.MapGet("/notifications/unread-count", async (ICurrentUser u, ITeamService s, CancellationToken ct) =>
            Results.Ok(ApiResponse.Ok(new { unreadCount = await s.GetMyUnreadNotificationCountAsync(Uid(u), ct) })));
        group.MapPost("/notifications", async (SendTeamNotificationRequest r, ICurrentUser u, ITeamService s, CancellationToken ct) =>
        {
            await s.SendNotificationAsync(Uid(u), r, ct);
            return Results.Ok(ApiResponse.NoContent());
        });
        group.MapPatch("/notifications/{id:guid}/read", async (Guid id, ICurrentUser u, ITeamService s, CancellationToken ct) =>
        {
            await s.MarkNotificationReadAsync(Uid(u), id, ct);
            return Results.Ok(ApiResponse.NoContent());
        });

        return app;
    }

    private static Guid Uid(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
}
