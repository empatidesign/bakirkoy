using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelBusEndpoints
{
    public static IEndpointRouteBuilder MapTravelBusEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travel-buses")
            .WithTags("Travels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("travels.view");
        group.MapGet("/summary", GetSummary).RequirePermission("travels.view");
        group.MapGet("/available", GetAvailable).RequirePermission("travels.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("travels.view");
        group.MapPost("/", Create).RequirePermission("travels.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("travels.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("travels.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("travels.edit");
        group.MapPost("/{id:guid}/clone", Clone).RequirePermission("travels.create");
        group.MapGet("/{id:guid}/usage-history", GetUsageHistory).RequirePermission("travels.view");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] TravelBusListParams p, ITravelBusService service, CancellationToken ct)
    {
        if (p.All == true && p.TravelId.HasValue)
            return Results.Ok(ApiResponse.Ok(await service.GetByTravelAsync(p.TravelId.Value, ct)));
        return Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));
    }

    private static async Task<IResult> GetSummary(Guid? travelId, ITravelBusService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(travelId, ct)));

    private static async Task<IResult> GetAvailable(Guid? travelId, DateTime? startDate, DateTime? endDate, ITravelBusService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAvailableAsync(travelId, startDate, endDate, ct)));

    private static async Task<IResult> GetById(Guid id, ITravelBusService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        TravelBusFormRequest req, ITravelBusService service, IValidator<TravelBusFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/travel-buses/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, TravelBusFormRequest req, ITravelBusService service, IValidator<TravelBusFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ITravelBusService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ITravelBusService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> Clone(Guid id, ITravelBusService service, CancellationToken ct)
    {
        var result = await service.CloneAsync(id, ct);
        return Results.Created($"/api/v1/travel-buses/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> GetUsageHistory(Guid id, ITravelBusService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetUsageHistoryAsync(id, ct)));
}
