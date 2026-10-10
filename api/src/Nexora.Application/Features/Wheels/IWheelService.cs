using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels;

public interface IWheelService
{
    Task<PagedResult<WheelDto>> GetPagedAsync(WheelListParams p, CancellationToken ct);
    Task<WheelSummaryDto> GetSummaryAsync(WheelListParams p, CancellationToken ct);
    Task<WheelDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<WheelDto> CreateAsync(WheelUpsertRequest req, CancellationToken ct);
    Task<WheelDto> UpdateAsync(Guid id, WheelUpsertRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<WheelDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
