using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Events;

public static class EventApplicationEndpoints
{
    public static IEndpointRouteBuilder MapEventApplicationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/event-applications")
            .WithTags("EventApplications")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("sessions.view");
        group.MapGet("/summary", GetSummary).RequirePermission("sessions.view");
        group.MapGet("/export", Export).RequirePermission("sessions.view");
        group.MapGet("/seat-map", GetSeatMap).RequirePermission("sessions.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("sessions.view");
        group.MapPost("/", Create).RequirePermission("sessions.approve");
        group.MapPut("/{id:guid}", Update).RequirePermission("sessions.edit");
        group.MapPatch("/{id:guid}/status", SetStatus).RequirePermission("sessions.approve");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("sessions.delete");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] ApplicationListParams p, IEventApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> Export(
        string? search, Guid? eventId, Guid? sessionId, string? status, string? sort, string? order,
        IEventApplicationService service, CancellationToken ct)
    {
        var p = new ApplicationListParams
        {
            Page = "1", Limit = "10000",
            Search = search, EventId = eventId, SessionId = sessionId, Status = status, Sort = sort, Order = order
        };
        var (content, fileName) = await service.ExportAsync(p, ct);
        return Results.File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static async Task<IResult> GetSummary(Guid? eventId, Guid? sessionId, IEventApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(eventId, sessionId, ct)));

    private static async Task<IResult> GetById(Guid id, IEventApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> GetSeatMap(Guid eventId, Guid? sessionId, IEventApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatMapAsync(eventId, sessionId, ct)));

    private static async Task<IResult> Create(
        ApplicationFormRequest req, IEventApplicationService service, IValidator<ApplicationFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/event-applications/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, ApplicationFormRequest req, IEventApplicationService service, IValidator<ApplicationFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> SetStatus(Guid id, SetApplicationStatusRequest req, IEventApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SetStatusAsync(id, req.Status, req.Reason, ct)));

    private static async Task<IResult> Delete(Guid id, IEventApplicationService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
