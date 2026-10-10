using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies;

public interface IDiscountUsageService
{
    Task<PagedResult<DiscountUsageDto>> GetPagedAsync(DiscountUsageListParams p, CancellationToken ct);
    Task<DiscountUsageSummaryDto> GetSummaryAsync(DiscountUsageListParams p, CancellationToken ct);
    Task<DiscountUsageDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<DiscountUsageDto> CancelAsync(Guid id, string? reason, CancellationToken ct);
}
