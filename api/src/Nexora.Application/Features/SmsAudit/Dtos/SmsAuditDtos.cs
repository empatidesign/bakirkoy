namespace Nexora.Application.Features.SmsAudit.Dtos;

public record SmsSendLogListItemDto(
    Guid Id,
    DateTime CreatedAt,
    Guid AdminUserId,
    string AdminUserName,
    string? Department,
    string Module,
    string? Description,
    int RecipientCount,
    bool UsedPinOverride,
    bool UsedOtp,
    bool WasBlocked,
    string? BlockReason,
    string? IpAddress
);

/// <summary>Dashboard üst kısmındaki özet kartlar için ("bugün" UTC gün bazlı).</summary>
public record SmsDashboardSummaryDto(
    int TodaySentCount,
    int TodayBlockedCount,
    int TodayPinOverrideCount,
    int TodayOtpVerifiedCount,
    int TodayTotalRecipients,
    int ActiveUserCount
);

public record SmsDailyStatItemDto(DateOnly Date, int Sent, int Blocked, int PinOverrides, int OtpVerified);

public record SmsUserStatItemDto(
    Guid AdminUserId,
    string AdminUserName,
    string? Department,
    int Sent,
    int Blocked,
    int PinOverrides,
    int OtpVerified,
    int TotalRecipients
);

public record SmsDepartmentStatItemDto(
    string Department,
    int Sent,
    int Blocked,
    int PinOverrides,
    int OtpVerified,
    int TotalRecipients
);

public sealed record SmsAuditListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public Guid? AdminUserId { get; init; }
    public string? Department { get; init; }
    public string? Module { get; init; }
    public bool? WasBlocked { get; init; }
    public DateTime? DateFrom { get; init; }
    public DateTime? DateTo { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public sealed record SmsAuditStatsQuery
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}
