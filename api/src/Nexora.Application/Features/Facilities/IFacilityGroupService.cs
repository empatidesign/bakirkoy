using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityGroupService
{
    Task<PagedResult<FacilityGroupDto>> GetPagedAsync(string module, FacilityGroupListParams p, CancellationToken ct);
    Task<FacilityGroupDto> GetByIdAsync(string module, Guid id, CancellationToken ct);
    Task<List<FacilityGroupOptionDto>> GetOptionsAsync(string module, Guid? facilityId, CancellationToken ct);
    Task<FacilityGroupDto> CreateAsync(string module, CreateFacilityGroupRequest req, CancellationToken ct);
    Task<FacilityGroupDto> CreateSubGroupAsync(string module, CreateSubGroupRequest req, CancellationToken ct);
    Task<CopyFacilityGroupResult> CopyAsync(string module, Guid id, CopyFacilityGroupRequest req, CancellationToken ct);
    Task<FacilityGroupDto> UpdateAsync(string module, Guid id, UpdateFacilityGroupRequest req, bool confirmAttendanceDeletion, CancellationToken ct);
    Task DeleteAsync(string module, Guid id, CancellationToken ct);
    Task DeleteAllByFacilityAsync(string module, Guid facilityId, CancellationToken ct);
    Task<FacilityGroupDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct);
    Task<IReadOnlyList<string>> GetAcademyWhitelistAsync(string module, Guid id, CancellationToken ct);
    Task SetAcademyWhitelistAsync(string module, Guid id, IReadOnlyList<string> tckns, CancellationToken ct);
    Task<PagedResult<FacilityGroupDto>> GetTrashAsync(string module, FacilityGroupListParams p, CancellationToken ct);
    Task<FacilityGroupDto> RestoreAsync(string module, Guid id, CancellationToken ct);
    Task PermanentDeleteAsync(string module, Guid id, CancellationToken ct);
    // Kullanıcı isteği (2026-10-05): gruplar/seanslar manuel sürükle-bırak ile sıralanabilsin.
    // parentGroupId null ise ana gruplar, doluysa o grubun seansları kapsamındadır.
    Task ReorderAsync(string module, Guid facilityId, Guid? parentGroupId, IReadOnlyList<Guid> orderedIds, CancellationToken ct);
}
