using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Public;
using Nexora.Domain.Entities.Events;

namespace Nexora.Application.Common.Repositories;

public interface IEventRepository : IRepository<Event>
{
    Task<PagedResult<Event>> GetPagedAsync(EventListParams p, CancellationToken ct, HashSet<Guid>? scopedIds = null);
    /// <summary>Sayfalamasız filtreli liste — sonucu kendisi sayfalayan çağrılar için.</summary>
    Task<List<Event>> GetAllFilteredAsync(EventListParams p, CancellationToken ct);
    Task<List<Event>> GetPublicDiscoverAsync(PublicEventQuery q, DateTime now, CancellationToken ct);
    Task<PagedResult<Event>> GetTrashAsync(EventListParams p, CancellationToken ct);
    Task<Event?> GetAnyByIdAsync(Guid id, CancellationToken ct);
    Task<int> NextCodeNumberAsync(CancellationToken ct);
    Task<(int Total, int Active, int TotalRegistered, int TotalCapacity)> GetSummaryAsync(EventListParams p, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct);
    Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct);
    void HardRemove(Event entity);
    Task<List<Guid>> GetIdsByFacilityIdsAsync(IList<Guid> facilityIds, CancellationToken ct);
    Task<List<Event>> GetOptionsAsync(string? search, CancellationToken ct);
    Task<Event?> GetByStaticQrCodeAsync(string code, CancellationToken ct);
    Task<bool> ExistsByStaticQrCodeAsync(string code, CancellationToken ct);
}
