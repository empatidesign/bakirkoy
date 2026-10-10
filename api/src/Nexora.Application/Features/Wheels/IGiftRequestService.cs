using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels;

public interface IGiftRequestService
{
    Task<PagedResult<GiftRequestDto>> GetPagedAsync(GiftRequestListParams p, CancellationToken ct);
    Task<GiftRequestSummaryDto> GetSummaryAsync(GiftRequestListParams p, CancellationToken ct);
    Task<GiftRequestDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<GiftRequestDto> ApproveAsync(Guid id, CancellationToken ct);
    Task<GiftRequestDto> RejectAsync(Guid id, string? reason, CancellationToken ct);
    Task<GiftRequestDto> DeliverAsync(Guid id, string? note, CancellationToken ct);
    Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct);
}
