using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Bakkart;

public class BakkartTransaction : BaseEntity
{
    public Guid CardId { get; private set; }
    public BakkartTransactionType Type { get; private set; }
    public decimal AmountDelta { get; private set; }
    public int PointsDelta { get; private set; }
    public decimal BalanceAfter { get; private set; }
    public int PointsAfter { get; private set; }
    public string? Description { get; private set; }
    public string? PerformedBy { get; private set; }
    public DateTime OccurredAt { get; private set; }

    private BakkartTransaction() { }

    public static BakkartTransaction Create(
        Guid cardId,
        BakkartTransactionType type,
        decimal amountDelta,
        int pointsDelta,
        decimal balanceAfter,
        int pointsAfter,
        string? description,
        string? performedBy)
        => new()
        {
            CardId = cardId,
            Type = type,
            AmountDelta = amountDelta,
            PointsDelta = pointsDelta,
            BalanceAfter = balanceAfter,
            PointsAfter = pointsAfter,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            PerformedBy = performedBy,
            OccurredAt = DateTime.UtcNow,
        };
}
