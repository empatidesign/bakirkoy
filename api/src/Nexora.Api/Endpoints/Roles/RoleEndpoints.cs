using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Roles;
using Nexora.Application.Features.Roles.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Roles;

public static class RoleEndpoints
{
    public static IEndpointRouteBuilder MapRoleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/roles")
            .WithTags("Roles")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("permissions.view");
        // 2026-07-30: /options endpoint'inde hiç izin kontrolü yoktu, sadece AdminOrAbove
        // yeterliydi (herhangi bir admin, rol yönetimi izni olmasa da tüm rol/izin adlarını
        // görebiliyordu). Admins ve Roles ekranlarının ikisi de bu endpoint'i kullandığı için
        // her iki iznin herhangi birine sahip olmak yeterli sayıldı.
        group.MapGet("/options", GetOptions).RequireAnyPermission("permissions.view", "admins.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("permissions.view");
        group.MapPost("/", Create).RequirePermission("permissions.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("permissions.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("permissions.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("permissions.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] RoleListParams p, IRoleService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(IRoleService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetById(Guid id, IRoleService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(CreateRoleRequest req, IRoleService service, IValidator<CreateRoleRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/roles/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(Guid id, UpdateRoleRequest req, IRoleService service, IValidator<UpdateRoleRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, IRoleService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, IRoleService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
