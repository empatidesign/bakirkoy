using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Application.Features.Events;

public interface IEventCategoryService
{
    Task<PagedResult<EventCategoryDto>> GetPagedAsync(EventCategoryListParams p, CancellationToken ct);
    Task<List<EventCategoryOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<EventCategorySummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<EventCategoryDto> CreateAsync(CreateEventCategoryRequest req, CancellationToken ct);
    Task<BulkCreateEventCategoryResult> BulkCreateAsync(BulkCreateEventCategoryRequest req, CancellationToken ct);
    Task<EventCategoryDto> UpdateAsync(Guid id, UpdateEventCategoryRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<EventCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<EventCategoryDto> RestoreAsync(Guid id, CancellationToken ct);
}
