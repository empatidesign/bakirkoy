using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Features.Travels;

public interface ITravelCategoryService
{
    Task<PagedResult<TravelCategoryDto>> GetPagedAsync(TravelCategoryListParams p, CancellationToken ct);
    Task<List<TravelCategoryOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<TravelCategoryDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<TravelCategoryDto> CreateAsync(TravelCategoryFormRequest req, CancellationToken ct);
    Task<TravelCategoryDto> UpdateAsync(Guid id, TravelCategoryFormRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<TravelCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
