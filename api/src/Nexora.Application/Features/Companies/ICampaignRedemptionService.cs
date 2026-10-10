using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Application.Features.Companies;

public interface ICampaignRedemptionService
{
    Task<PagedResult<CampaignRedemptionDto>> GetPagedAsync(CampaignRedemptionListParams p, CancellationToken ct);
    Task<CampaignRedemptionSummaryDto> GetSummaryAsync(CampaignRedemptionListParams p, CancellationToken ct);
    Task<CampaignRedemptionDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<CampaignRedemptionDto> CancelAsync(Guid id, string? reason, CancellationToken ct);
}
