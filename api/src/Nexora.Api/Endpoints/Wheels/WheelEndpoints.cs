using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Wheels;

public static class WheelEndpoints
{
    public static IEndpointRouteBuilder MapWheelEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/wheels")
            .WithTags("Wheels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("wheel.view");
        group.MapGet("/summary", GetSummary).RequirePermission("wheel.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("wheel.view");
        group.MapPost("/", Create).RequirePermission("wheel.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("wheel.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("wheel.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("wheel.edit");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] WheelListParams p,
        IWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        string? status,
        IWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new WheelListParams { Search = search, Status = status }, ct)));

    private static async Task<IResult> GetById(
        Guid id,
        IWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        WheelUpsertRequest req,
        IWheelService service,
        IValidator<WheelUpsertRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/wheels/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        WheelUpsertRequest req,
        IWheelService service,
        IValidator<WheelUpsertRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.UpdateAsync(id, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IWheelService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IWheelService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
