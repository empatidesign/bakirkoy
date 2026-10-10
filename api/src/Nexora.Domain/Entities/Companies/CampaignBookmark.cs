using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;

namespace Nexora.Domain.Entities.Companies;

public class CampaignBookmark : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public Guid CampaignId { get; private set; }

    public Participant Participant { get; private set; } = default!;
    public Campaign Campaign { get; private set; } = default!;

    private CampaignBookmark() { }

    public static CampaignBookmark Create(Guid participantId, Guid campaignId)
        => new()
        {
            ParticipantId = participantId,
            CampaignId = campaignId
        };
}
