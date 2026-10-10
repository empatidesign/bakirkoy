using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Application.Features.Seda;

public interface ISedaDefinitionService
{
    Task<PagedResult<SedaDefinitionDto>> GetPagedAsync(SedaDefinitionListParams p, CancellationToken ct);
    Task<List<SedaOptionDto>> GetOptionsAsync(string type, CancellationToken ct);
    Task<SedaDefinitionDto> CreateAsync(CreateSedaDefinitionRequest req, CancellationToken ct);
    Task<SedaDefinitionDto> UpdateAsync(Guid id, UpdateSedaDefinitionRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<SedaDefinitionDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
