using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;

namespace Nexora.Application.Common.Repositories;

public interface ISessionRepository : IRepository<Session>
{
    Task<PagedResult<Session>> GetPagedAsync(SessionListParams p, IReadOnlyCollection<Guid>? scopedRefIds, CancellationToken ct);
    Task<List<Session>> GetByEventAsync(Guid eventId, CancellationToken ct);
    Task<int> CountActiveByEventAsync(Guid eventId, CancellationToken ct);
    Task<List<Session>> GetConflictingAsync(Guid hallId, DateTime date, string startTime, string endTime, Guid? excludeId, CancellationToken ct);
    Task<int> NextCodeNumberAsync(CancellationToken ct);
    Task<(int Total, int Active, int TotalRegistered, int TotalCapacity)> GetSummaryAsync(Guid? eventId, CancellationToken ct);
}
