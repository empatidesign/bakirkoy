using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Companies;

public static class ServiceCategoryEndpoints
{
    public static IEndpointRouteBuilder MapServiceCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/service-categories")
            .WithTags("ServiceCategories")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("companies.view");
        group.MapGet("/options", GetOptions).RequirePermission("companies.view");
        group.MapGet("/summary", GetSummary).RequirePermission("companies.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("companies.view");
        group.MapPost("/", Create).RequirePermission("companies.edit");
        group.MapPut("/{id:guid}", Update).RequirePermission("companies.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("companies.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("companies.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] ServiceCategoryListParams p, IServiceCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(IServiceCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetSummary(IServiceCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> GetById(Guid id, IServiceCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        CreateServiceCategoryRequest req,
        IServiceCategoryService service,
        IValidator<CreateServiceCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/service-categories/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateServiceCategoryRequest req,
        IServiceCategoryService service,
        IValidator<UpdateServiceCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, IServiceCategoryService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, IServiceCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
