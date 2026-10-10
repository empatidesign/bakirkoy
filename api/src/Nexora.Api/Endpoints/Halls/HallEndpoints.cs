using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Halls;
using Nexora.Application.Features.Halls.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Halls;

public static class HallEndpoints
{
    public static IEndpointRouteBuilder MapHallEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/halls")
            .WithTags("Halls")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("halls.view");
        group.MapGet("/summary", GetSummary).RequirePermission("halls.view");

        group.MapGet("/feature-catalog", GetCatalog).RequirePermission("halls.view");
        group.MapPost("/feature-groups", CreateGroup).RequirePermission("halls.edit");
        group.MapPut("/feature-groups/{key}", UpdateGroup).RequirePermission("halls.edit");
        group.MapDelete("/feature-groups/{key}", DeleteGroup).RequirePermission("halls.delete");
        group.MapPost("/features", CreateFeature).RequirePermission("halls.edit");
        group.MapPut("/features/{key}", UpdateFeature).RequirePermission("halls.edit");
        group.MapDelete("/features/{key}", DeleteFeature).RequirePermission("halls.delete");

        group.MapGet("/feature-templates", GetTemplates).RequirePermission("halls.view");
        group.MapPost("/feature-templates", CreateTemplate).RequirePermission("halls.edit");
        group.MapDelete("/feature-templates/{id:guid}", DeleteTemplate).RequirePermission("halls.delete");

        group.MapGet("/{id:guid}", GetById).RequirePermission("halls.view");
        group.MapGet("/{id:guid}/seat-plan", GetSeatPlan).RequirePermission("halls.view");
        group.MapPut("/{id:guid}/seat-plan", SaveSeatPlan).RequirePermission("halls.edit");
        group.MapPost("/", Create).RequirePermission("halls.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("halls.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("halls.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("halls.edit");

        group.MapGet("/{id:guid}/devices", GetHallDevices).RequirePermission("halls.view");
        group.MapPost("/{id:guid}/devices", CreateHallDevice).RequirePermission("halls.devices");
        group.MapPut("/devices/{deviceId:guid}", UpdateHallDevice).RequirePermission("halls.devices");
        group.MapDelete("/devices/{deviceId:guid}", DeleteHallDevice).RequirePermission("halls.devices");
        group.MapPatch("/devices/{deviceId:guid}/toggle-status", ToggleHallDevice).RequirePermission("halls.devices");
        group.MapPost("/devices/{deviceId:guid}/rotate-key", RotateHallDeviceKey).RequirePermission("halls.devices");
        group.MapPost("/devices/{deviceId:guid}/test-lock", TestHallDeviceLock).RequirePermission("halls.devices");
        group.MapPost("/devices/{deviceId:guid}/open", ManualOpenHallDevice).RequirePermission("halls.manual-open");

        var citizen = app.MapGroup("/api/v1/public/halls")
            .WithTags("Halls")
            .RequireAuthorization("Citizen");
        citizen.MapGet("/feature-catalog", GetCatalog);

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] HallListParams p, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        Guid? facilityId, string? type, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new HallListParams { FacilityId = facilityId, Type = type }, ct)));

    private static async Task<IResult> GetById(Guid id, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        CreateHallRequest req, IHallService service, IValidator<CreateHallRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/halls/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, CreateHallRequest req, IHallService service, IValidator<CreateHallRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, IHallService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> GetSeatPlan(Guid id, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatPlanAsync(id, ct)));

    private static async Task<IResult> SaveSeatPlan(
        Guid id, SeatPlanRequest req, IHallService service, CancellationToken ct)
    {
        await service.SaveSeatPlanAsync(id, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetCatalog(IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetCatalogAsync(ct)));

    private static async Task<IResult> CreateGroup(
        FeatureGroupRequest req, IHallService service, IValidator<FeatureGroupRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.CreateGroupAsync(req, ct)));
    }

    private static async Task<IResult> UpdateGroup(
        string key, FeatureGroupRequest req, IHallService service, IValidator<FeatureGroupRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.UpdateGroupAsync(key, req, ct)));
    }

    private static async Task<IResult> DeleteGroup(string key, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DeleteGroupAsync(key, ct)));

    private static async Task<IResult> CreateFeature(
        FeatureRequest req, IHallService service, IValidator<FeatureRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.CreateFeatureAsync(req, ct)));
    }

    private static async Task<IResult> UpdateFeature(
        string key, FeatureRequest req, IHallService service, IValidator<FeatureRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Ok(ApiResponse.Ok(await service.UpdateFeatureAsync(key, req, ct)));
    }

    private static async Task<IResult> DeleteFeature(string key, IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DeleteFeatureAsync(key, ct)));

    private static async Task<IResult> GetTemplates(IHallService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTemplatesAsync(ct)));

    private static async Task<IResult> CreateTemplate(
        FeatureTemplateRequest req, IHallService service, IValidator<FeatureTemplateRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);
        return Results.Created("/api/v1/halls/feature-templates", ApiResponse.Created(await service.CreateTemplateAsync(req, ct)));
    }

    private static async Task<IResult> DeleteTemplate(Guid id, IHallService service, CancellationToken ct)
    {
        await service.DeleteTemplateAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetHallDevices(Guid id, IFacilityDeviceService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.GetByHallAsync(id, ct)));

    private static async Task<IResult> CreateHallDevice(Guid id, CreateHallDeviceRequest req, IFacilityDeviceService svc, CancellationToken ct)
    {
        var result = await svc.CreateForHallAsync(id, req, ct);
        return Results.Created($"/api/v1/halls/devices/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UpdateHallDevice(Guid deviceId, UpdateFacilityDeviceRequest req, IFacilityDeviceService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.UpdateHallDeviceAsync(deviceId, req, ct)));

    private static async Task<IResult> DeleteHallDevice(Guid deviceId, IFacilityDeviceService svc, CancellationToken ct)
    {
        await svc.DeleteHallDeviceAsync(deviceId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleHallDevice(Guid deviceId, IFacilityDeviceService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.ToggleHallDeviceAsync(deviceId, ct)));

    private static async Task<IResult> RotateHallDeviceKey(Guid deviceId, IFacilityDeviceService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.RotateHallDeviceKeyAsync(deviceId, ct)));

    private static async Task<IResult> TestHallDeviceLock(Guid deviceId, IFacilityDeviceService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.TestHallDeviceLockAsync(deviceId, ct)));

    private static async Task<IResult> ManualOpenHallDevice(Guid deviceId, IFacilityDeviceService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.ManualOpenHallDeviceAsync(deviceId, ct)));
}
