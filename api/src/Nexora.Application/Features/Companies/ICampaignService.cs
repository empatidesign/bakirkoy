using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies;

public interface ICampaignService
{
    Task<PagedResult<CampaignDto>> GetPagedAsync(CampaignListParams p, CancellationToken ct);
    Task<CampaignSummaryDto> GetSummaryAsync(CampaignListParams p, CancellationToken ct);
    Task<IReadOnlyList<CampaignOptionDto>> GetOptionsAsync(Guid? companyId, CancellationToken ct);
    Task<CampaignDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<CampaignDto> CreateAsync(CreateCampaignRequest req, CancellationToken ct);
    Task<CampaignDto> UpdateAsync(Guid id, UpdateCampaignRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<CampaignDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
