using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryOperationsEndpoints
{
    public static IEndpointRouteBuilder MapLibraryOperationsEndpoints(this IEndpointRouteBuilder app)
    {
        var libraries = app.MapGroup("/api/v1/libraries").WithTags("Libraries").RequireAuthorization("AdminOrAbove");
        libraries.MapGet("/overdue-books", GetOverdueBooks).RequirePermission("library.view");
        libraries.MapGet("/emanet-status", async (Nexora.Application.Features.Libraries.IEmanetService e, CancellationToken ct) => Results.Ok(ApiResponse.Ok(await e.GetStatusAsync(ct))))
            .RequirePermission("library.view");
        libraries.MapGet("/all/persons", GetAllLibrariesPersons).RequirePermission("library.view");
        libraries.MapGet("/{libraryId:guid}/occupants", GetOccupants).RequirePermission("library.view");
        libraries.MapGet("/{libraryId:guid}/queue", GetQueue).RequirePermission("library.view");
        libraries.MapGet("/{libraryId:guid}/breaks", GetBreaks).RequirePermission("library.view");
        libraries.MapGet("/{libraryId:guid}/exited", GetExited).RequirePermission("library.view");
        libraries.MapPost("/{libraryId:guid}/messages/send", SendManualMessage).RequirePermission("library.edit");
        libraries.MapPost("/{libraryId:guid}/check-in", CheckIn).RequirePermission("library.edit");
        libraries.MapPost("/{libraryId:guid}/scan", Scan).RequirePermission("library.edit");
        libraries.MapPost("/{libraryId:guid}/queue/call-next", CallNext).RequirePermission("library.edit");
        libraries.MapPost("/{libraryId:guid}/reservations", CreateReservation).RequirePermission("library.edit");
        libraries.MapGet("/{libraryId:guid}/seat-plan", GetSeatPlan).RequirePermission("library.view");
        libraries.MapDelete("/reservations/{reservationId:guid}", CancelReservation).RequirePermission("library.edit");
        libraries.MapPut("/{libraryId:guid}/seat-plan", SaveSeatMaintenance).RequirePermission("library.edit");
        libraries.MapPut("/{libraryId:guid}/seat-structure", SaveSeatStructure).RequirePermission("library.edit");

        var sessions = app.MapGroup("/api/v1/library-sessions").WithTags("Libraries").RequireAuthorization("AdminOrAbove");
        sessions.MapPost("/{sessionId:guid}/exit", Exit).RequirePermission("library.edit");
        sessions.MapPatch("/{sessionId:guid}/seat", ChangeSeat).RequirePermission("library.edit");

        var queue = app.MapGroup("/api/v1/library-queue").WithTags("Libraries").RequireAuthorization("AdminOrAbove");
        queue.MapPost("/{queueId:guid}/enter", MarkEntered).RequirePermission("library.edit");
        queue.MapPost("/{queueId:guid}/expire", ExpireQueue).RequirePermission("library.edit");

        var breaks = app.MapGroup("/api/v1/library-breaks").WithTags("Libraries").RequireAuthorization("AdminOrAbove");
        breaks.MapPost("/{breakId:guid}/end", EndBreak).RequirePermission("library.edit");

        var members = app.MapGroup("/api/v1/library-members").WithTags("Libraries").RequireAuthorization("AdminOrAbove");
        members.MapPost("/{memberId:guid}/warn", Warn).RequirePermission("library.edit");

        return app;
    }

    private static async Task<IResult> GetOverdueBooks([AsParameters] LibraryOverdueListParams p, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetOverdueBooksAsync(p, ct)));

    private static async Task<IResult> GetAllLibrariesPersons([AsParameters] AllLibrariesPersonListParams p, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetAllLibrariesPersonsAsync(p, ct)));

    private static async Task<IResult> GetOccupants(Guid libraryId, [AsParameters] OccupantListParams p, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetOccupantsAsync(libraryId, p, ct)));

    private static async Task<IResult> GetQueue(Guid libraryId, [AsParameters] QueueListParams p, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetQueueAsync(libraryId, p, ct)));

    private static async Task<IResult> GetBreaks(Guid libraryId, [AsParameters] BreakListParams p, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetBreaksAsync(libraryId, p, ct)));

    private static async Task<IResult> GetExited(Guid libraryId, [AsParameters] ExitedListParams p, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetExitedAsync(libraryId, p, ct)));

    private static async Task<IResult> SendManualMessage(Guid libraryId, LibraryManualMessageRequest req, ILibraryNotificationService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.SendManualMessageAsync(libraryId, req.SessionIds, req.TemplateEvent, req.CustomText, req.Sms, req.Notify, req.SmsOtp, ct)));

    private static async Task<IResult> CheckIn(Guid libraryId, LibraryCheckInRequest req, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.CheckInAsync(libraryId, req, ct)));

    private static async Task<IResult> Scan(Guid libraryId, LibraryScanRequest req, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.ScanAccessAsync(libraryId, req.Token, req.Action, ct)));

    private static async Task<IResult> GetSeatPlan(Guid libraryId, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetSeatPlanAsync(libraryId, ct)));

    private static async Task<IResult> SaveSeatMaintenance(Guid libraryId, SeatMaintenanceRequest req, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.SaveSeatMaintenanceAsync(libraryId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> SaveSeatStructure(Guid libraryId, SeatStructureRequest req, ILibraryOperationsService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.SaveSeatStructureAsync(libraryId, req, ct)));

    private static async Task<IResult> CallNext(Guid libraryId, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.CallNextAsync(libraryId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> CreateReservation(Guid libraryId, LibraryReservationRequest req, ILibraryOperationsService s, IValidator<LibraryReservationRequest> v, CancellationToken ct)
    {
        var validation = await v.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await s.CreateReservationAsync(libraryId, req, ct)));
    }

    private static async Task<IResult> CancelReservation(Guid reservationId, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.CancelReservationAsync(reservationId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Exit(Guid sessionId, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.ExitAsync(sessionId, true, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ChangeSeat(Guid sessionId, ChangeSeatRequest req, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.ChangeSeatAsync(sessionId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> MarkEntered(Guid queueId, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.MarkEnteredAsync(queueId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ExpireQueue(Guid queueId, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.ExpireQueueAsync(queueId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> EndBreak(Guid breakId, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.EndBreakAsync(breakId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Warn(Guid memberId, WarnRequest req, ILibraryOperationsService s, CancellationToken ct)
    {
        await s.WarnAsync(memberId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
