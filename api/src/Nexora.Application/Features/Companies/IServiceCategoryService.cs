using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies;

public interface IServiceCategoryService
{
    Task<PagedResult<ServiceCategoryDto>> GetPagedAsync(ServiceCategoryListParams p, CancellationToken ct);
    Task<List<ServiceCategoryRefDto>> GetOptionsAsync(CancellationToken ct);
    Task<ServiceCategorySummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<ServiceCategoryDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<ServiceCategoryDto> CreateAsync(CreateServiceCategoryRequest req, CancellationToken ct);
    Task<ServiceCategoryDto> UpdateAsync(Guid id, UpdateServiceCategoryRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<ServiceCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task<ServiceCategoryRefDto> CreateOrGetByNameAsync(string name, CancellationToken ct);
}
