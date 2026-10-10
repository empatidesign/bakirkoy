using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.SmsAudit;
using Nexora.Application.Features.SmsAudit.Dtos;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Infrastructure.Services;

public class SmsAuditDashboardService(IUnitOfWork uow) : ISmsAuditDashboardService
{
    public async Task<PagedResult<SmsSendLogListItemDto>> GetPagedAsync(SmsAuditListParams p, CancellationToken ct)
    {
        var paged = await uow.SmsSendLogs.GetPagedAsync(new SmsSendLogListParams
        {
            Page = p.PageResolved,
            Limit = p.LimitResolved,
            Search = p.Search,
            AdminUserId = p.AdminUserId,
            Department = p.Department,
            Module = p.Module,
            WasBlocked = p.WasBlocked,
            DateFrom = p.DateFrom,
            DateTo = p.DateTo,
            Sort = p.Sort,
            Order = p.Order,
        }, ct);

        return new PagedResult<SmsSendLogListItemDto>
        {
            Items = paged.Items.Select(ToListItem).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<SmsDashboardSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var todayStartUtc = DateTime.UtcNow.Date;
        var todayEndUtc = todayStartUtc.AddDays(1);

        var daily = await uow.SmsSendLogs.GetDailyStatsAsync(todayStartUtc, todayEndUtc, ct);
        var todayStat = daily.FirstOrDefault(d => d.Date == DateOnly.FromDateTime(todayStartUtc));

        var userStats = await uow.SmsSendLogs.GetUserStatsAsync(todayStartUtc, todayEndUtc, ct);
        var activeUserCount = userStats.Count(u => u.Sent > 0 || u.Blocked > 0);
        var totalRecipients = userStats.Sum(u => u.TotalRecipients);

        return new SmsDashboardSummaryDto(
            TodaySentCount: todayStat?.Sent ?? 0,
            TodayBlockedCount: todayStat?.Blocked ?? 0,
            TodayPinOverrideCount: todayStat?.PinOverrides ?? 0,
            TodayOtpVerifiedCount: todayStat?.OtpVerified ?? 0,
            TodayTotalRecipients: totalRecipients,
            ActiveUserCount: activeUserCount
        );
    }

    public async Task<List<SmsDailyStatItemDto>> GetDailyStatsAsync(SmsAuditStatsQuery q, CancellationToken ct)
    {
        var (from, to) = ResolveRange(q, defaultDays: 30);
        var stats = await uow.SmsSendLogs.GetDailyStatsAsync(from, to, ct);
        return stats.Select(s => new SmsDailyStatItemDto(s.Date, s.Sent, s.Blocked, s.PinOverrides, s.OtpVerified)).ToList();
    }

    public async Task<List<SmsUserStatItemDto>> GetUserStatsAsync(SmsAuditStatsQuery q, CancellationToken ct)
    {
        var (from, to) = ResolveRange(q, defaultDays: 30);
        var stats = await uow.SmsSendLogs.GetUserStatsAsync(from, to, ct);
        return stats
            .OrderByDescending(s => s.Sent)
            .Select(s => new SmsUserStatItemDto(s.AdminUserId, s.AdminUserName, s.Department, s.Sent, s.Blocked, s.PinOverrides, s.OtpVerified, s.TotalRecipients))
            .ToList();
    }

    public async Task<List<SmsDepartmentStatItemDto>> GetDepartmentStatsAsync(SmsAuditStatsQuery q, CancellationToken ct)
    {
        var (from, to) = ResolveRange(q, defaultDays: 30);
        var stats = await uow.SmsSendLogs.GetDepartmentStatsAsync(from, to, ct);
        return stats
            .OrderByDescending(s => s.Sent)
            .Select(s => new SmsDepartmentStatItemDto(s.Department, s.Sent, s.Blocked, s.PinOverrides, s.OtpVerified, s.TotalRecipients))
            .ToList();
    }

    private static (DateTime from, DateTime to) ResolveRange(SmsAuditStatsQuery q, int defaultDays)
    {
        var to = (q.To ?? DateTime.UtcNow.Date.AddDays(1)).Date;
        var from = (q.From ?? to.AddDays(-defaultDays)).Date;
        return (from, to);
    }

    private static SmsSendLogListItemDto ToListItem(SmsSendLog s)
        => new(s.Id, s.CreatedAt, s.AdminUserId, s.AdminUserName, s.Department, s.Module,
            s.Description, s.RecipientCount, s.UsedPinOverride, s.UsedOtp, s.WasBlocked, s.BlockReason, s.IpAddress);
}
