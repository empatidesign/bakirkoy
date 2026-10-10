using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Departments.Dtos;

namespace Nexora.Application.Features.Departments;

public interface IDepartmentService
{
    Task<PagedResult<DepartmentDto>> GetPagedAsync(DepartmentListParams p, CancellationToken ct);
    Task<List<DepartmentOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<DepartmentDto> CreateAsync(CreateDepartmentRequest req, CancellationToken ct);
    Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<DepartmentDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
