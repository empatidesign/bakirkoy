using Nexora.Application.Common.ApiResponse;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Application.Common.Repositories;

public interface ISmsSendLogRepository : IRepository<SmsSendLog>
{
    /// <summary>Belirtilen kullanıcının UTC "bugün" içinde WasBlocked=false (başarılı) bir gönderimi var mı.</summary>
    Task<bool> HasSentTodayAsync(Guid adminUserId, CancellationToken ct);

    Task<PagedResult<SmsSendLog>> GetPagedAsync(SmsSendLogListParams p, CancellationToken ct);

    /// <summary>Dashboard: tarih aralığında, günlere göre gönderim/engelleme sayıları.</summary>
    Task<List<SmsDailyStatDto>> GetDailyStatsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct);

    /// <summary>Dashboard: tarih aralığında, kullanıcı bazında toplam gönderim/engelleme sayıları.</summary>
    Task<List<SmsUserStatDto>> GetUserStatsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct);

    /// <summary>Dashboard: tarih aralığında, departman bazında toplam gönderim/engelleme sayıları.</summary>
    Task<List<SmsDepartmentStatDto>> GetDepartmentStatsAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct);
}

public sealed record SmsSendLogListParams
{
    public int Page { get; init; } = 1;
    public int Limit { get; init; } = 25;
    public string? Search { get; init; }
    public Guid? AdminUserId { get; init; }
    public string? Department { get; init; }
    public string? Module { get; init; }
    public bool? WasBlocked { get; init; }
    public DateTime? DateFrom { get; init; }
    public DateTime? DateTo { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }

    public int PageResolved => Page < 1 ? 1 : Page;
    public int LimitResolved => Limit is < 1 or > 200 ? 25 : Limit;
}

public sealed record SmsDailyStatDto(DateOnly Date, int Sent, int Blocked, int PinOverrides, int OtpVerified);
public sealed record SmsUserStatDto(Guid AdminUserId, string AdminUserName, string? Department, int Sent, int Blocked, int PinOverrides, int OtpVerified, int TotalRecipients);
public sealed record SmsDepartmentStatDto(string Department, int Sent, int Blocked, int PinOverrides, int OtpVerified, int TotalRecipients);
