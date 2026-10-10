using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.SmsAudit;
using Nexora.Application.Features.SmsAudit.Dtos;

namespace Nexora.Api.Endpoints.SmsAudit;

public static class SmsAuditEndpoints
{
    public static IEndpointRouteBuilder MapSmsAuditEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/sms-audit")
            .WithTags("SmsAudit")
            .RequireAuthorization();

        // Güvenlik denetimi bulgusu (2026-09-19): bu dashboard kullanıcı/departman
        // bazlı SMS gönderim davranışını (PIN-muafiyet kullanımı dahil) ifşa ediyor —
        // genel "logs.view" yerine dar kapsamlı "sms-audit.view" izni kullanılır.
        group.MapGet("/", GetList).RequirePermission("sms-audit.view");
        group.MapGet("/summary", GetSummary).RequirePermission("sms-audit.view");
        group.MapGet("/daily-stats", GetDailyStats).RequirePermission("sms-audit.view");
        group.MapGet("/user-stats", GetUserStats).RequirePermission("sms-audit.view");
        group.MapGet("/department-stats", GetDepartmentStats).RequirePermission("sms-audit.view");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] SmsAuditListParams p, ISmsAuditDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(ISmsAuditDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> GetDailyStats([AsParameters] SmsAuditStatsQuery q, ISmsAuditDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDailyStatsAsync(q, ct)));

    private static async Task<IResult> GetUserStats([AsParameters] SmsAuditStatsQuery q, ISmsAuditDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetUserStatsAsync(q, ct)));

    private static async Task<IResult> GetDepartmentStats([AsParameters] SmsAuditStatsQuery q, ISmsAuditDashboardService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDepartmentStatsAsync(q, ct)));
}
