using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICampaignRedemptionRepository : IRepository<CampaignRedemption>
{
    Task<List<CampaignRedemption>> GetByCompanyIdAsync(Guid companyId, CancellationToken ct);
    Task<List<CampaignRedemption>> GetByParticipantIdAsync(Guid participantId, CancellationToken ct);
    Task<int> CountByParticipantAndCampaignAsync(Guid participantId, Guid campaignId, CancellationToken ct);
    Task<Dictionary<Guid, int>> GetParticipantCountsByCampaignsAsync(Guid participantId, IEnumerable<Guid> campaignIds, CancellationToken ct);
    Task<PagedResult<CampaignRedemption>> GetPagedAsync(CampaignRedemptionListParams p, CancellationToken ct);
    Task<CampaignRedemptionSummaryDto> GetSummaryAsync(CampaignRedemptionListParams p, CancellationToken ct);
    Task<CampaignRedemption?> GetByIdWithDetailsAsync(Guid id, CancellationToken ct);
}
