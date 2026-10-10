using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Loyalty;

public class RewardRedemption : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public Guid RewardId { get; private set; }
    public string RewardName { get; private set; } = string.Empty;
    public int PointsSpent { get; private set; }
    public int BalanceAfter { get; private set; }
    public DateTime RedeemedAt { get; private set; } = DateTime.UtcNow;
    public string Status { get; private set; } = "Pending";
    public DateTime? CancelledAt { get; private set; }
    public string? CancelReason { get; private set; }

    public static RewardRedemption Create(Guid participantId, Guid rewardId, string rewardName, int pointsSpent, int balanceAfter) => new()
    {
        ParticipantId = participantId,
        RewardId = rewardId,
        RewardName = rewardName,
        PointsSpent = pointsSpent,
        BalanceAfter = balanceAfter,
        RedeemedAt = DateTime.UtcNow,
        Status = "Pending",
    };

    public void Cancel(string? reason)
    {
        Status = "Cancelled";
        CancelledAt = DateTime.UtcNow;
        CancelReason = reason;
    }

    public void Complete()
    {
        Status = "Completed";
    }
}
