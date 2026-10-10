using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Domain.Entities.Halls;

namespace Nexora.Application.Common.Repositories;

public interface IHallRepository : IRepository<Hall>
{
    Task<PagedResult<Hall>> GetPagedAsync(HallListParams p, CancellationToken ct, IReadOnlyCollection<Guid>? restrictIds = null);
    Task<HallSummaryDto> GetSummaryAsync(HallListParams p, CancellationToken ct);
    Task<List<Hall>> GetByFacilityAsync(Guid facilityId, CancellationToken ct);
    Task<List<Guid>> GetIdsByFacilityIdsAsync(IList<Guid> facilityIds, CancellationToken ct);
}
