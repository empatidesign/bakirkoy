using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Companies;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CampaignBookmarkRepository(AppDbContext context)
    : Repository<CampaignBookmark>(context), ICampaignBookmarkRepository
{
    public async Task<CampaignBookmark?> GetAsync(Guid participantId, Guid campaignId, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(b => b.ParticipantId == participantId && b.CampaignId == campaignId, ct);

    public async Task<CampaignBookmark?> GetIncludingDeletedAsync(Guid participantId, Guid campaignId, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters()
            .FirstOrDefaultAsync(b => b.ParticipantId == participantId && b.CampaignId == campaignId, ct);

    public async Task<bool> ExistsAsync(Guid participantId, Guid campaignId, CancellationToken ct)
        => await DbSet.AnyAsync(b => b.ParticipantId == participantId && b.CampaignId == campaignId, ct);

    public async Task<HashSet<Guid>> GetBookmarkedCampaignIdsAsync(Guid participantId, CancellationToken ct)
        => (await DbSet
            .Where(b => b.ParticipantId == participantId)
            .Select(b => b.CampaignId)
            .ToListAsync(ct)).ToHashSet();
}
