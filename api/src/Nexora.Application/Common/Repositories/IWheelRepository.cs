using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Domain.Entities.Wheels;

namespace Nexora.Application.Common.Repositories;

public interface IWheelRepository : IRepository<Wheel>
{
    Task<PagedResult<Wheel>> GetPagedAsync(WheelListParams p, CancellationToken ct);
    Task<WheelSummaryDto> GetSummaryAsync(WheelListParams p, CancellationToken ct);
}
