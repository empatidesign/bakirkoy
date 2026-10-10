using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities;

public interface IFacilityInstructorService
{
    Task<PagedResult<FacilityInstructorDto>> GetPagedAsync(string module, FacilityInstructorListParams p, CancellationToken ct);
    Task<List<FacilityInstructorOptionDto>> GetOptionsAsync(string module, CancellationToken ct);
    Task<FacilityInstructorDto> CreateAsync(string module, CreateFacilityInstructorRequest req, CancellationToken ct);
    Task<FacilityInstructorDto> UpdateAsync(string module, Guid id, UpdateFacilityInstructorRequest req, CancellationToken ct);
    Task DeleteAsync(string module, Guid id, CancellationToken ct);
    Task<FacilityInstructorDto> ToggleStatusAsync(string module, Guid id, CancellationToken ct);
}
