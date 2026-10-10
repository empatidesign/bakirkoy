using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Admin.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Admin;

public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admins")
            .WithTags("Admins")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("admins.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("admins.view");
        group.MapPost("/", Create).RequirePermission("admins.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("admins.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("admins.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("admins.edit");
        group.MapPost("/{id:guid}/send-password-reset", SendPasswordReset).RequirePermission("admins.edit");
        group.MapPost("/{id:guid}/set-password", SetManualPassword).RequirePermission("admins.edit");
        group.MapPost("/{id:guid}/unlock", Unlock).RequirePermission("admins.edit");
        group.MapPost("/scoped-staff", AssignScopedStaff).RequirePermission("admins.create");

        return app;
    }

    private static async Task<IResult> Unlock(
        Guid id,
        IAdminUserManagementService service,
        CancellationToken ct)
    {
        var result = await service.UnlockAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> AssignScopedStaff(
        AssignScopedStaffRequest req,
        IScopedStaffService service,
        IValidator<AssignScopedStaffRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.AssignAsync(req, ct);
        return Results.Created($"/api/v1/admins/{result.AdminUserId}", ApiResponse.Created(result));
    }

    private static async Task<IResult> SendPasswordReset(
        Guid id,
        SendPasswordResetRequest req,
        IAdminUserManagementService service,
        IValidator<SendPasswordResetRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.SendPasswordResetAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> SetManualPassword(
        Guid id,
        AdminSetManualPasswordRequest req,
        IAdminUserManagementService service,
        IValidator<AdminSetManualPasswordRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        await service.SetManualPasswordAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetList(
        [AsParameters] AdminListParams p,
        IAdminUserManagementService service,
        CancellationToken ct)
    {
        var result = await service.GetPagedAsync(p, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetById(
        Guid id,
        IAdminUserManagementService service,
        CancellationToken ct)
    {
        var result = await service.GetByIdAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Create(
        CreateAdminRequest req,
        IAdminUserManagementService service,
        IValidator<CreateAdminRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/admins/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateAdminRequest req,
        IAdminUserManagementService service,
        IValidator<UpdateAdminRequest> validator,
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
        IAdminUserManagementService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IAdminUserManagementService service,
        CancellationToken ct)
    {
        var result = await service.ToggleStatusAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}
