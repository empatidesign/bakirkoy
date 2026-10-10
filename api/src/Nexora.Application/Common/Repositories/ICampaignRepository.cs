using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICampaignRepository : IRepository<Campaign>
{
    Task<PagedResult<Campaign>> GetPagedAsync(CampaignListParams p, CancellationToken ct);
    Task<CampaignSummaryDto> GetSummaryAsync(CampaignListParams p, CancellationToken ct);
    Task<Campaign?> GetByIdWithCompanyAsync(Guid id, CancellationToken ct);
    Task<List<Campaign>> GetActiveWithCompanyAsync(CancellationToken ct);
    Task<List<Campaign>> GetVisibleWithCompanyAsync(CancellationToken ct);
    Task<List<Campaign>> GetOptionsAsync(Guid? companyId, CancellationToken ct);
    Task<int> CountActiveByCompanyAsync(Guid companyId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountVisibleByCompaniesAsync(IEnumerable<Guid> companyIds, CancellationToken ct);
}
