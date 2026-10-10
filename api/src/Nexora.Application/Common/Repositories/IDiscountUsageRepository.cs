using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface IDiscountUsageRepository : IRepository<DiscountUsage>
{
    Task<PagedResult<DiscountUsage>> GetPagedAsync(DiscountUsageListParams p, CancellationToken ct);
    Task<DiscountUsageSummaryDto> GetSummaryAsync(DiscountUsageListParams p, CancellationToken ct);
    Task<DiscountUsage?> GetByIdWithDetailsAsync(Guid id, CancellationToken ct);
    Task<int> CountUserUsageAsync(Guid campaignId, Guid userId, CancellationToken ct);
    Task<Dictionary<Guid, int>> GetUserUsageCountsByCampaignsAsync(Guid userId, IEnumerable<Guid> campaignIds, CancellationToken ct);
    Task<List<DiscountUsage>> GetUserUsagesAsync(Guid userId, CancellationToken ct);
    Task<PagedResult<CompanyCampaignUsageDto>> GetCompanyUsagesAsync(Guid companyId, CompanyCampaignUsageListParams p, CancellationToken ct);
}

