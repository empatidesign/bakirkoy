using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;

namespace Nexora.Application.Common.Repositories;

public interface IGiftRepository : IRepository<Gift>
{
    Task<PagedResult<Gift>> GetPagedAsync(GiftListParams p, CancellationToken ct);
    Task<GiftSummaryDto> GetSummaryAsync(GiftListParams p, CancellationToken ct);
    Task<List<Gift>> GetActiveAsync(CancellationToken ct);
}
