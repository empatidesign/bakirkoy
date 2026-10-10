using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.AuditLogs.Dtos;

namespace Nexora.Application.Features.AuditLogs;

public interface IAuditLogService
{
    Task<PagedResult<AuditLogListItemDto>> GetPagedAsync(AuditLogListParams p, CancellationToken ct);
    Task<AuditLogDetailDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<AuditLogFilterOptionsDto> GetFilterOptionsAsync(CancellationToken ct);
}
