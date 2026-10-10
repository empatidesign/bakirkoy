using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;

namespace Nexora.Application.Common.Repositories;

public interface ITravelRouteRepository : IRepository<TravelRoute>
{
    Task<PagedResult<TravelRoute>> GetPagedAsync(TravelRouteListParams p, CancellationToken ct);
    Task<List<TravelRoute>> GetOptionsAsync(string? search, CancellationToken ct);
    Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct);
}
