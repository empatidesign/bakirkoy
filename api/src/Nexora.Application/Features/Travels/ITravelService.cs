using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelService
{
    Task<PagedResult<TravelDto>> GetPagedAsync(TravelListParams p, CancellationToken ct);
    Task<PagedResult<TravelDto>> GetTrashAsync(TravelListParams p, CancellationToken ct);
    Task<TravelSummaryDto> GetSummaryAsync(Guid? routeId, CancellationToken ct);
    Task<TravelDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<List<TravelOptionDto>> GetOptionsAsync(string? search, bool includeInactive, CancellationToken ct);
    Task<TravelDto> CreateAsync(TravelFormRequest req, CancellationToken ct);
    Task<TravelDto> UpdateAsync(Guid id, TravelFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<TravelDto> RestoreAsync(Guid id, CancellationToken ct);
    Task PermanentDeleteAsync(Guid id, CancellationToken ct);
    Task<TravelDto> CopyAsync(Guid id, TravelCopyRequest req, CancellationToken ct);
    Task<TravelBulkCopyResult> BulkCopyAsync(Guid id, TravelBulkCopyRequest req, CancellationToken ct);
    Task<TravelDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<List<TravelAuditEntryDto>> GetAuditLogAsync(Guid id, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, string? purpose, CancellationToken ct);
}
