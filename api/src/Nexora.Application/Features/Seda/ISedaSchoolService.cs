using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface ISedaSchoolService
{
    Task<PagedResult<SedaSchoolDto>> GetPagedAsync(SedaSchoolListParams p, CancellationToken ct);
    Task<List<SedaOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<SedaSchoolDto> CreateAsync(SedaSchoolFormRequest req, CancellationToken ct);
    Task<SedaSchoolDto> UpdateAsync(Guid id, SedaSchoolFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<SedaSchoolDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
