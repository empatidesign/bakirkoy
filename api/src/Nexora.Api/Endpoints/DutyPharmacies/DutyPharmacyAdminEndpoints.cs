using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.DutyPharmacies;
using Nexora.Infrastructure.Services.Scheduled;

namespace Nexora.Api.Endpoints.DutyPharmacies;

public static class DutyPharmacyAdminEndpoints
{
    public static IEndpointRouteBuilder MapDutyPharmacyAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/duty-pharmacies")
            .WithTags("DutyPharmacies")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("duty-pharmacies.view");
        group.MapGet("/sync-status", GetSyncStatus).RequirePermission("duty-pharmacies.view");
        group.MapPost("/sync", TriggerSync).RequirePermission("duty-pharmacies.edit");

        return app;
    }

    private static async Task<IResult> GetList(IDutyPharmacyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetActiveAsync(ct)));

    private static async Task<IResult> GetSyncStatus(IDutyPharmacyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSyncStatusAsync(ct)));

    private static async Task<IResult> TriggerSync(IDutyPharmacySyncJob job, CancellationToken ct)
    {
        await job.RunAsync(ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
