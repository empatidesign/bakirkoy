using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;

namespace Nexora.Application.Common.Repositories;

public interface IEventCategoryRepository : IRepository<EventCategory>
{
    Task<PagedResult<EventCategory>> GetPagedAsync(EventCategoryListParams p, CancellationToken ct);
    Task<List<EventCategory>> GetActiveAsync(CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
    Task<EventCategory?> GetAnyByIdAsync(Guid id, CancellationToken ct);
}
