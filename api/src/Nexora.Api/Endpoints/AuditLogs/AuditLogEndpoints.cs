using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.AuditLogs;
using Nexora.Application.Features.AuditLogs.Dtos;

namespace Nexora.Api.Endpoints.AuditLogs;

public static class AuditLogEndpoints
{
    public static IEndpointRouteBuilder MapAuditLogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/audit-logs")
            .WithTags("AuditLogs")
            .RequireAuthorization();

        group.MapGet("/", GetList).RequirePermission("logs.view");
        group.MapGet("/filters", GetFilters).RequirePermission("logs.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("logs.view");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] AuditLogListParams p, IAuditLogService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetFilters(IAuditLogService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetFilterOptionsAsync(ct)));

    private static async Task<IResult> GetById(Guid id, IAuditLogService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));
}
