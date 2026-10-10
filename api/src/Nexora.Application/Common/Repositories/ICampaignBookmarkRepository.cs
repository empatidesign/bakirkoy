using Nexora.Domain.Entities.Companies;

namespace Nexora.Application.Common.Repositories;

public interface ICampaignBookmarkRepository : IRepository<CampaignBookmark>
{
    Task<CampaignBookmark?> GetAsync(Guid participantId, Guid campaignId, CancellationToken ct);
    Task<CampaignBookmark?> GetIncludingDeletedAsync(Guid participantId, Guid campaignId, CancellationToken ct);
    Task<bool> ExistsAsync(Guid participantId, Guid campaignId, CancellationToken ct);
    Task<HashSet<Guid>> GetBookmarkedCampaignIdsAsync(Guid participantId, CancellationToken ct);
}
