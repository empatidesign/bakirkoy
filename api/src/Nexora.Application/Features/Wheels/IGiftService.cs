using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels.Dtos;

namespace Nexora.Application.Features.Wheels;

public interface IGiftService
{
    Task<PagedResult<GiftDto>> GetPagedAsync(GiftListParams p, CancellationToken ct);
    Task<GiftSummaryDto> GetSummaryAsync(GiftListParams p, CancellationToken ct);
    Task<IReadOnlyList<GiftOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<GiftDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<GiftDto> CreateAsync(GiftUpsertRequest req, CancellationToken ct);
    Task<GiftDto> UpdateAsync(Guid id, GiftUpsertRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<GiftDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
}
