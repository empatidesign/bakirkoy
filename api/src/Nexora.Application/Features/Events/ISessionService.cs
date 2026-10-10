using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Halls.Dtos;

namespace Nexora.Application.Features.Events;

public interface ISessionService
{
    Task<PagedResult<SessionDto>> GetPagedAsync(SessionListParams p, CancellationToken ct);
    Task<SessionSummaryDto> GetSummaryAsync(Guid? eventId, CancellationToken ct);
    Task<SessionDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<List<SessionOptionDto>> GetOptionsByEventAsync(Guid eventId, CancellationToken ct);
    Task<SessionDto> CreateAsync(SessionFormRequest req, CancellationToken ct);
    Task<GenerateResultDto> GenerateAsync(SessionFormRequest req, CancellationToken ct);
    Task<int> RegenerateForRangeAsync(Guid eventId, DateTime fromDate, DateTime toDate, CancellationToken ct);
    Task<int> PropagateEventCapacityAsync(Guid eventId, int newCapacity, CancellationToken ct);
    Task<Dictionary<string, string>> GetSeatPlanAsync(Guid sessionId, CancellationToken ct);
    Task SaveSeatPlanAsync(Guid sessionId, SeatPlanRequest req, CancellationToken ct);
    Task<HallSeatChangeImpactDto> PropagateHallSeatChangeAsync(Guid hallId, CancellationToken ct);
    Task<List<SessionConflictDto>> CheckConflictsAsync(SessionFormRequest req, CancellationToken ct);
    Task<SessionDto> UpdateAsync(Guid id, SessionFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<int> DeleteAfterDateAsync(Guid eventId, DateTime afterDate, CancellationToken ct);
    Task<SessionDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<int> DeactivateByHallAsync(Guid hallId, CancellationToken ct);
}
