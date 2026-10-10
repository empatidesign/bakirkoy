using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Bakkart;

public class BakkartCard : BaseEntity
{
    public Guid ApplicationId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string CardNo { get; private set; } = "";
    public BakkartCardType CardType { get; private set; }
    public BakkartCardStatus Status { get; private set; }
    public decimal Balance { get; private set; }
    public int Points { get; private set; }
    public DateTime IssuedAt { get; private set; }
    public string? BlockReason { get; private set; }

    public BakkartApplication? Application { get; private set; }
    public List<BakkartTransaction> Transactions { get; private set; } = [];

    private BakkartCard() { }

    public static BakkartCard Create(Guid applicationId, Guid? participantId, string cardNo, BakkartCardType cardType)
        => new()
        {
            ApplicationId = applicationId,
            ParticipantId = participantId,
            CardNo = cardNo,
            CardType = cardType,
            Status = BakkartCardStatus.Active,
            Balance = 0,
            Points = 0,
            IssuedAt = DateTime.UtcNow,
        };

    public void AdjustBalance(decimal delta)
    {
        Balance += delta;
        if (Balance < 0) Balance = 0;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AdjustPoints(int delta)
    {
        Points += delta;
        if (Points < 0) Points = 0;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(BakkartCardStatus status, string? reason = null)
    {
        Status = status;
        BlockReason = status == BakkartCardStatus.Blocked ? reason : null;
        UpdatedAt = DateTime.UtcNow;
    }
}
