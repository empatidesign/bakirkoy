using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.SmsPermissions;
using Nexora.Application.Features.SmsPermissions.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.SmsPermissions;

// Kullanıcı isteği (2026-10-04): admin panel "Roller > Toplu İşlemler" sayfasının backend
// ucu. "sms-send.assign" izni, sms gönderme yetkisini/kapsamını BAŞKALARINA dağıtabilme
// yetkisidir — "sms-send.send" (bizzat SMS gönderebilme) ile kasıtlı olarak ayrıdır.
public static class SmsPermissionEndpoints
{
    public static IEndpointRouteBuilder MapSmsPermissionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/sms-permissions")
            .WithTags("SmsPermissions")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/roles", GetRoles).RequirePermission("sms-send.assign");
        group.MapGet("/users-with-access", GetUsersWithAccess).RequirePermission("sms-send.assign");
        group.MapPost("/bulk-access", BulkSetAccess).RequirePermission("sms-send.assign");
        group.MapPost("/bulk-scope", BulkAssignScope).RequirePermission("sms-send.assign");

        return app;
    }

    private static async Task<IResult> GetRoles(ISmsPermissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetRolesAsync(ct)));

    private static async Task<IResult> GetUsersWithAccess(ISmsPermissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetUsersWithSmsSendAccessAsync(ct)));

    private static async Task<IResult> BulkSetAccess(
        BulkSmsSendAccessRequest req,
        ISmsPermissionService service,
        IValidator<BulkSmsSendAccessRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.BulkSetSmsSendAccessAsync(req, ct)));
    }

    private static async Task<IResult> BulkAssignScope(
        BulkScopeAssignmentRequest req,
        ISmsPermissionService service,
        IValidator<BulkScopeAssignmentRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.BulkAssignScopeAsync(req, ct)));
    }
}
