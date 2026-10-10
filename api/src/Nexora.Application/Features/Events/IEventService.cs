using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Halls.Dtos;

namespace Nexora.Application.Features.Events;

public interface IEventService
{
    Task<PagedResult<EventDto>> GetPagedAsync(EventListParams p, CancellationToken ct);
    Task<PagedResult<EventDto>> GetTrashAsync(EventListParams p, CancellationToken ct);
    Task<EventSummaryDto> GetSummaryAsync(EventListParams p, CancellationToken ct);
    Task<List<EventOptionDto>> GetOptionsAsync(string? search, CancellationToken ct);
    Task<EventDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<EventDto> CreateAsync(EventFormRequest req, CancellationToken ct);
    Task<EventDto> UpdateAsync(Guid id, EventFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<EventDto> RestoreAsync(Guid id, CancellationToken ct);
    Task PermanentDeleteAsync(Guid id, CancellationToken ct);
    Task<EventDto> CopyAsync(Guid id, CancellationToken ct);
    Task<EventBulkCopyResult> BulkCopyAsync(Guid id, EventBulkCopyRequest req, CancellationToken ct);
    Task<EventDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<Dictionary<string, string>> GetSeatPlanAsync(Guid eventId, CancellationToken ct);
    Task SaveSeatPlanAsync(Guid eventId, SeatPlanRequest req, CancellationToken ct);
    Task<List<EventAuditEntryDto>> GetAuditLogAsync(Guid id, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, string? purpose, CancellationToken ct);
}
