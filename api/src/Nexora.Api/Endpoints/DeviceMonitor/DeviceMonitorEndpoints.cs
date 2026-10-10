using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.DeviceMonitor;

namespace Nexora.Api.Endpoints.DeviceMonitor;

public static class DeviceMonitorEndpoints
{
    public static IEndpointRouteBuilder MapDeviceMonitorEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/device-monitor").WithTags("DeviceMonitor").RequireAuthorization("AdminOrAbove");

        group.MapGet("/snapshot", async (IDeviceMonitorService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetSnapshotAsync(ct)))).RequirePermission("device-monitor.view");

        return app;
    }
}
