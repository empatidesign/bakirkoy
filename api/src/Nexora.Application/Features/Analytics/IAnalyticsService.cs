using Nexora.Application.Features.Analytics.Dtos;

namespace Nexora.Application.Features.Analytics;

public interface IAnalyticsService
{
    Task<AnalyticsOverviewDto> GetOverviewAsync(AnalyticsOverviewParams p, CancellationToken ct);

    Task<DashboardActivityDto> GetDashboardActivityAsync(CancellationToken ct);

    /// <summary>Anlık online kullanıcı sayısı + son saatlerin 5 dakikalık trendi.</summary>
    Task<OnlineUsersDto> GetOnlineUsersAsync(int trendHours, CancellationToken ct);
}
