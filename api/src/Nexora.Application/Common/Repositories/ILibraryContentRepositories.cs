using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Application.Common.Repositories;

public interface ILibraryRuleRepository : IRepository<LibraryRule>
{
    Task<PagedResult<LibraryRule>> GetPagedAsync(LibraryRuleListParams p, CancellationToken ct);
    Task<LibraryRuleSummaryDto> GetSummaryAsync(Guid? libraryId, CancellationToken ct);
}
