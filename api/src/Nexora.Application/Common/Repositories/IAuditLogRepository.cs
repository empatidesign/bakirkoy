using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.AuditLogs.Dtos;
using Nexora.Domain.Entities.Specialized;

namespace Nexora.Application.Common.Repositories;

public interface IAuditLogRepository : IRepository<AuditLog>
{
    Task<PagedResult<AuditLog>> GetPagedAsync(AuditLogListParams p, CancellationToken ct);
    Task<(List<string> Modules, List<string> EntityTypes)> GetFilterOptionsAsync(CancellationToken ct);
}
