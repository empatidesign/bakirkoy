using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.EmergencyAreas;
using Nexora.Application.Features.EmergencyAreas.Dtos;
using Nexora.Application.Common.Exceptions;
using Nexora.Infrastructure.Services.Scheduled;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.EmergencyAreas;

public static class EmergencyAreaEndpoints
{
    public static IEndpointRouteBuilder MapEmergencyAreaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/emergency-areas")
            .WithTags("EmergencyAreas")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("emergency-areas.view");
        group.MapGet("/summary", GetSummary).RequirePermission("emergency-areas.view");
        group.MapGet("/map-points", GetMapPoints).RequirePermission("emergency-areas.view");
        group.MapGet("/neighborhoods", GetNeighborhoods).RequirePermission("emergency-areas.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("emergency-areas.view");
        group.MapPost("/", Create).RequirePermission("emergency-areas.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("emergency-areas.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("emergency-areas.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("emergency-areas.edit");
        group.MapGet("/afad-sync/status", GetAfadSyncStatus).RequirePermission("emergency-areas.view");
        group.MapPost("/afad-sync", RunAfadSync).RequirePermission("emergency-areas.edit");

        return app;
    }

    private static async Task<IResult> GetAfadSyncStatus(IAfadGisSyncJob job, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await job.GetStatusAsync(ct)));

    private static async Task<IResult> RunAfadSync(IAfadGisSyncJob job, CancellationToken ct)
    {
        var result = await job.SyncAsync(ct);
        if (!result.Success)
            throw new ConflictException($"AFAD GIS senkronizasyonu tamamlanamadı: {result.Error}", "AFAD_GIS_SYNC_FAILED");
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetList(
        [AsParameters] EmergencyAreaListParams p,
        IEmergencyAreaService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        string? neighborhood,
        string? status,
        IEmergencyAreaService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new EmergencyAreaListParams
            {
                Search = search,
                Neighborhood = neighborhood,
                Status = status,
            }, ct)));

    private static async Task<IResult> GetMapPoints(
        IEmergencyAreaService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMapPointsAsync(ct)));

    private static async Task<IResult> GetNeighborhoods(
        IEmergencyAreaService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetNeighborhoodOptionsAsync(ct)));

    private static async Task<IResult> GetById(
        Guid id,
        IEmergencyAreaService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        EmergencyAreaRequest req,
        IEmergencyAreaService service,
        IValidator<EmergencyAreaRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/emergency-areas/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        EmergencyAreaRequest req,
        IEmergencyAreaService service,
        IValidator<EmergencyAreaRequest> validator,
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
        IEmergencyAreaService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IEmergencyAreaService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
