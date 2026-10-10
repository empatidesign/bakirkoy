using Nexora.Domain.Common;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Companies;

public class CampaignRedemption : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid? CampaignId { get; private set; }
    public RedemptionType RedemptionType { get; private set; }
    public DateTime RedeemedAt { get; private set; }
    public string? Notes { get; private set; }
    public string RedemptionCode { get; private set; } = default!;
    public bool IsCancelled { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public string? CancelReason { get; private set; }

    public Participant Participant { get; private set; } = default!;
    public Company Company { get; private set; } = default!;
    public Campaign? Campaign { get; private set; }

    private CampaignRedemption() { }

    public static CampaignRedemption Create(Guid participantId, Guid companyId, Guid? campaignId, RedemptionType type, string? notes)
        => new()
        {
            ParticipantId = participantId,
            CompanyId = companyId,
            CampaignId = campaignId,
            RedemptionType = type,
            RedeemedAt = DateTime.UtcNow,
            Notes = notes,
            RedemptionCode = Guid.NewGuid().ToString("N")[..12].ToUpper()
        };

    public void Cancel(string? reason)
    {
        if (IsCancelled) return;
        IsCancelled = true;
        CancelledAt = DateTime.UtcNow;
        CancelReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }
}
