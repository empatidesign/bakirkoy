using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.History.Dtos;

namespace Nexora.Application.Features.History;

public interface IHistoryService
{
    Task<PagedResult<HistoryItemDto>> GetHistoryAsync(HistoryListParams p, CancellationToken ct);
}
