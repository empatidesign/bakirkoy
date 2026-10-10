using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Application.Features.Reviews;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Events;

public static class EventEndpoints
{
    public static IEndpointRouteBuilder MapEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/events")
            .WithTags("Events")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("events.view");
        group.MapGet("/trash", GetTrash).RequirePermission("events.view");
        group.MapGet("/summary", GetSummary).RequirePermission("events.view");
        group.MapGet("/options", GetOptions).RequirePermission("events.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("events.view");
        group.MapPost("/", Create).RequirePermission("events.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("events.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("events.delete");
        group.MapPatch("/{id:guid}/restore", Restore).RequirePermission("events.edit");
        group.MapDelete("/{id:guid}/permanent", PermanentDelete).RequirePermission("events.delete");
        group.MapPost("/{id:guid}/copy", Copy).RequirePermission("events.create");
        group.MapPost("/{id:guid}/bulk-copy", BulkCopy).RequirePermission("events.create");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("events.edit");
        group.MapGet("/{id:guid}/seat-plan", GetSeatPlan).RequirePermission("events.view");
        group.MapPut("/{id:guid}/seat-plan", SaveSeatPlan).RequirePermission("events.edit");
        group.MapGet("/{id:guid}/audit", GetAudit).RequirePermission("events.view");
        group.MapGet("/{id:guid}/reviews", GetReviews).RequirePermission("events.view");
        group.MapPost("/images", UploadImage).DisableAntiforgery().RequirePermission("events.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] EventListParams p, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetTrash([AsParameters] EventListParams p, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTrashAsync(p, ct)));

    private static async Task<IResult> GetSummary([AsParameters] EventListParams p, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(p, ct)));

    private static async Task<IResult> GetOptions(string? search, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(search, ct)));

    private static async Task<IResult> GetById(Guid id, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        EventFormRequest req, IEventService service, IValidator<EventFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/events/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, EventFormRequest req, IEventService service, IValidator<EventFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, IEventService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Restore(Guid id, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RestoreAsync(id, ct)));

    private static async Task<IResult> PermanentDelete(Guid id, IEventService service, CancellationToken ct)
    {
        await service.PermanentDeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Copy(Guid id, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CopyAsync(id, ct)));

    private static async Task<IResult> BulkCopy(Guid id, EventBulkCopyRequest req, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.BulkCopyAsync(id, req, ct)));

    private static async Task<IResult> ToggleStatus(Guid id, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> GetSeatPlan(Guid id, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatPlanAsync(id, ct)));

    private static async Task<IResult> SaveSeatPlan(Guid id, SeatPlanRequest req, IEventService service, CancellationToken ct)
    {
        await service.SaveSeatPlanAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetAudit(Guid id, IEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAuditLogAsync(id, ct)));

    private static async Task<IResult> GetReviews(Guid id, IReviewService reviewService, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await reviewService.GetEventReviewsAdminAsync(id, ct)));

    private static async Task<IResult> UploadImage(IFormFile file, string? purpose, IEventService service, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var url = await service.UploadImageAsync(stream, file.FileName, file.ContentType, purpose, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }
}
