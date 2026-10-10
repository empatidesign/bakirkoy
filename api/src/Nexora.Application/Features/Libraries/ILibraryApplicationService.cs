using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries;

public interface ILibraryApplicationService
{
    Task<PagedResult<LibraryApplicationDto>> GetPagedAsync(LibraryApplicationListParams p, CancellationToken ct);
    Task<LibraryApplicationDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<LibraryApplicationSummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<LibraryApplicationDto> CreateAsync(LibraryApplicationRequest req, CancellationToken ct);
    Task<LibraryApplicationDto> ApproveAsync(Guid id, CancellationToken ct);
    Task<LibraryApplicationDto> RejectAsync(Guid id, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}
