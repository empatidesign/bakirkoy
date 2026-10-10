using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Departments;
using Nexora.Application.Features.Departments.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Departments;

public static class DepartmentEndpoints
{
    public static IEndpointRouteBuilder MapDepartmentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/departments")
            .WithTags("Departments")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("departments.view");
        group.MapGet("/options", GetOptions).RequirePermission("departments.view");
        group.MapPost("/", Create).RequirePermission("departments.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("departments.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("departments.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("departments.edit");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] DepartmentListParams p,
        IDepartmentService service,
        CancellationToken ct)
    {
        var result = await service.GetPagedAsync(p, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetOptions(
        IDepartmentService service,
        CancellationToken ct)
    {
        var result = await service.GetOptionsAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Create(
        CreateDepartmentRequest req,
        IDepartmentService service,
        IValidator<CreateDepartmentRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/departments/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateDepartmentRequest req,
        IDepartmentService service,
        IValidator<UpdateDepartmentRequest> validator,
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
        IDepartmentService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IDepartmentService service,
        CancellationToken ct)
    {
        var result = await service.ToggleStatusAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}
