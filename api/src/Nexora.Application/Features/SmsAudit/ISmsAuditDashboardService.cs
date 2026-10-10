using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.SmsAudit.Dtos;

namespace Nexora.Application.Features.SmsAudit;

/// <summary>SMS gönderim denetim/dashboard verilerini admin panel için hazırlayan servis.</summary>
public interface ISmsAuditDashboardService
{
    Task<PagedResult<SmsSendLogListItemDto>> GetPagedAsync(SmsAuditListParams p, CancellationToken ct);

    Task<SmsDashboardSummaryDto> GetSummaryAsync(CancellationToken ct);

    Task<List<SmsDailyStatItemDto>> GetDailyStatsAsync(SmsAuditStatsQuery q, CancellationToken ct);

    Task<List<SmsUserStatItemDto>> GetUserStatsAsync(SmsAuditStatsQuery q, CancellationToken ct);

    Task<List<SmsDepartmentStatItemDto>> GetDepartmentStatsAsync(SmsAuditStatsQuery q, CancellationToken ct);
}
