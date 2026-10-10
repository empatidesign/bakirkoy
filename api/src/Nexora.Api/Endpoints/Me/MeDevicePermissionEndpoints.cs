using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.DevicePermissions;
using Nexora.Application.Features.DevicePermissions.Dtos;
using AppForbiddenException = Nexora.Application.Common.Exceptions.ForbiddenException;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Me;

public static class MeDevicePermissionEndpoints
{
    public static IEndpointRouteBuilder MapMeDevicePermissionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/device-permission")
            .WithTags("MeDevicePermission")
            .RequireAuthorization("Citizen");

        group.MapGet("/", Get);
        group.MapPut("/", Save);

        return app;
    }

    private static async Task<IResult> Get(
        ICurrentUser currentUser, IDevicePermissionService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        var result = await service.GetAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Save(
        SaveDevicePermissionRequest req,
        ICurrentUser currentUser, IDevicePermissionService service,
        IValidator<SaveDevicePermissionRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var participantId = RequireParticipant(currentUser);
        var result = await service.SaveAsync(participantId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static Guid RequireParticipant(ICurrentUser currentUser)
        => currentUser.Id ?? throw new AppForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
}
