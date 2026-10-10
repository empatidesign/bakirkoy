using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityBranchService
{
    Task<PagedResult<FacilityBranchDto>> GetPagedAsync(string module, FacilityBranchListParams p, CancellationToken ct);
    Task<List<FacilityBranchOptionDto>> GetOptionsAsync(string module, CancellationToken ct);
    Task<FacilityBranchDto> CreateAsync(string module, CreateFacilityBranchRequest req, CancellationToken ct);
    Task<FacilityBranchDto> UpdateAsync(string module, Guid id, UpdateFacilityBranchRequest req, CancellationToken ct);
    Task DeleteAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityBranchDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct);
    Task<PagedResult<FacilityBranchDto>> GetTrashAsync(string module, FacilityBranchListParams p, CancellationToken ct);
    Task<FacilityBranchDto> RestoreAsync(string module, Guid id, CancellationToken ct);
    Task PermanentDeleteAsync(string module, Guid id, CancellationToken ct);
    Task<int> BulkUpdateCategoryAsync(string module, IReadOnlyList<Guid> ids, string? category, CancellationToken ct);
}
