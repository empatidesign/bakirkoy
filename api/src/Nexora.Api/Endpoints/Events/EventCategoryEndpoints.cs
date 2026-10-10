using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Events;

public static class EventCategoryEndpoints
{
    public static IEndpointRouteBuilder MapEventCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/event-categories")
            .WithTags("EventCategories")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("events.view");
        group.MapGet("/options", GetOptions).RequirePermission("events.view");
        group.MapGet("/summary", GetSummary).RequirePermission("events.view");
        group.MapPost("/", Create).RequirePermission("events.create");
        group.MapPost("/bulk", BulkCreate).RequirePermission("events.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("events.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("events.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("events.edit");
        group.MapPatch("/{id:guid}/restore", Restore).RequirePermission("events.edit");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] EventCategoryListParams p,
        IEventCategoryService service,
        CancellationToken ct)
    {
        var result = await service.GetPagedAsync(p, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetOptions(IEventCategoryService service, CancellationToken ct)
    {
        var result = await service.GetOptionsAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetSummary(IEventCategoryService service, CancellationToken ct)
    {
        var result = await service.GetSummaryAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Create(
        CreateEventCategoryRequest req,
        IEventCategoryService service,
        IValidator<CreateEventCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/event-categories/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> BulkCreate(
        BulkCreateEventCategoryRequest req,
        IEventCategoryService service,
        IValidator<BulkCreateEventCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.BulkCreateAsync(req, ct)));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateEventCategoryRequest req,
        IEventCategoryService service,
        IValidator<UpdateEventCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.UpdateAsync(id, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Delete(Guid id, IEventCategoryService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, IEventCategoryService service, CancellationToken ct)
    {
        var result = await service.ToggleStatusAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Restore(Guid id, IEventCategoryService service, CancellationToken ct)
    {
        var result = await service.RestoreAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}
