using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Application.Features.Libraries;

public interface ILibraryRuleService
{
    Task<PagedResult<LibraryRuleDto>> GetPagedAsync(LibraryRuleListParams p, CancellationToken ct);
    Task<LibraryRuleSummaryDto> GetSummaryAsync(Guid? libraryId, CancellationToken ct);
    Task<LibraryRuleDto> CreateAsync(LibraryRuleRequest req, CancellationToken ct);
    Task<LibraryRuleDto> UpdateAsync(Guid id, LibraryRuleRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<LibraryRuleDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
