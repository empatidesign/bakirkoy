using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Halls.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Events;

public static class SessionEndpoints
{
    public static IEndpointRouteBuilder MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/sessions")
            .WithTags("Sessions")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("sessions.view");
        group.MapGet("/summary", GetSummary).RequirePermission("sessions.view");
        group.MapGet("/options", GetOptions).RequirePermission("sessions.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("sessions.view");
        group.MapPost("/", Create).RequirePermission("sessions.create");
        group.MapPost("/generate", Generate).RequirePermission("sessions.create");
        group.MapPost("/check-conflicts", CheckConflicts).RequirePermission("sessions.view");
        group.MapPut("/{id:guid}", Update).RequirePermission("sessions.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("sessions.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("sessions.edit");
        group.MapGet("/{id:guid}/seat-plan", GetSeatPlan).RequirePermission("sessions.view");
        group.MapPut("/{id:guid}/seat-plan", SaveSeatPlan).RequirePermission("sessions.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] SessionListParams p, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(Guid? eventId, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(eventId, ct)));

    private static async Task<IResult> GetOptions(Guid eventId, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsByEventAsync(eventId, ct)));

    private static async Task<IResult> GetById(Guid id, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        SessionFormRequest req, ISessionService service, IValidator<SessionFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/sessions/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Generate(
        SessionFormRequest req, ISessionService service, IValidator<SessionFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.GenerateAsync(req, ct)));
    }

    private static async Task<IResult> CheckConflicts(SessionFormRequest req, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CheckConflictsAsync(req, ct)));

    private static async Task<IResult> Update(
        Guid id, SessionFormRequest req, ISessionService service, IValidator<SessionFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ISessionService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> GetSeatPlan(Guid id, ISessionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatPlanAsync(id, ct)));

    private static async Task<IResult> SaveSeatPlan(Guid id, SeatPlanRequest req, ISessionService service, CancellationToken ct)
    {
        await service.SaveSeatPlanAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
