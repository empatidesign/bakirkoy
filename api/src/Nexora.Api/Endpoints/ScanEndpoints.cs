using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Scan;

namespace Nexora.Api.Endpoints;

public static class ScanEndpoints
{
    public static IEndpointRouteBuilder MapScanEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/scan")
            .WithTags("Scan")
            .RequireAuthorization("AdminOrAbove");

        group.MapPost("/facility-entry", FacilityEntry).RequirePermission("qr-kiosk.scan");

        return app;
    }

    private static async Task<IResult> FacilityEntry(FacilityEntryScanRequest req, IFacilityEntryScanService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ScanEntryAsync(req, ct)));
}
