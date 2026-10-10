using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Loyalty;

public class LoyaltyTransaction : BaseEntity
{
    public Guid ParticipantId { get; private set; }
    public string ActionKey { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public int Points { get; private set; }
    public int BalanceAfter { get; private set; }
    public string? ReferenceId { get; private set; }
    public DateTime EarnedAt { get; private set; } = DateTime.UtcNow;

    public static LoyaltyTransaction Create(Guid participantId, string actionKey, string label, int points, int balanceAfter, string? referenceId = null) => new()
    {
        ParticipantId = participantId,
        ActionKey = actionKey,
        Label = label,
        Points = points,
        BalanceAfter = balanceAfter,
        ReferenceId = referenceId,
        EarnedAt = DateTime.UtcNow,
    };
}
