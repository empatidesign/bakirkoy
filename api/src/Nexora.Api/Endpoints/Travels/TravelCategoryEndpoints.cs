using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelCategoryEndpoints
{
    public static IEndpointRouteBuilder MapTravelCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travel-categories")
            .WithTags("Travels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("travels.view");
        group.MapGet("/options", GetOptions).RequirePermission("travels.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("travels.view");
        group.MapPost("/", Create).RequirePermission("travels.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("travels.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("travels.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("travels.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] TravelCategoryListParams p, ITravelCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(ITravelCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetById(Guid id, ITravelCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        TravelCategoryFormRequest req, ITravelCategoryService service, IValidator<TravelCategoryFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/travel-categories/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, TravelCategoryFormRequest req, ITravelCategoryService service, IValidator<TravelCategoryFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ITravelCategoryService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ITravelCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
