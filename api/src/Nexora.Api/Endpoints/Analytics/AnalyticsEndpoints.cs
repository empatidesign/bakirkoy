using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Analytics;
using Nexora.Application.Features.Analytics.Dtos;

namespace Nexora.Api.Endpoints.Analytics;

public static class AnalyticsEndpoints
{
    public static IEndpointRouteBuilder MapAnalyticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/analytics")
            .WithTags("Analytics")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/overview", GetOverview).RequirePermission("dashboard.view");
        group.MapGet("/dashboard-activity", GetDashboardActivity).RequirePermission("dashboard.view");
        group.MapGet("/online-users", GetOnlineUsers).RequirePermission("dashboard.view");

        return app;
    }

    private static async Task<IResult> GetOverview(
        [AsParameters] AnalyticsOverviewParams p,
        IAnalyticsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOverviewAsync(p, ct)));

    private static async Task<IResult> GetDashboardActivity(
        IAnalyticsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDashboardActivityAsync(ct)));

    // Kullanıcı isteği (2026-09-07): son 5 dakikada aktif kullanıcı sayısı ve trendi.
    private static async Task<IResult> GetOnlineUsers(
        IAnalyticsService service,
        CancellationToken ct,
        int trendHours = 24)
        => Results.Ok(ApiResponse.Ok(await service.GetOnlineUsersAsync(trendHours, ct)));
}
