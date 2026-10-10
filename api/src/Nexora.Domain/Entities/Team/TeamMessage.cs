using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Team;

public class TeamMessage : BaseEntity
{
    public Guid SenderId { get; private set; }
    public Guid RecipientId { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public DateTime? ReadAt { get; private set; }

    public static TeamMessage Create(Guid senderId, Guid recipientId, string text)
        => new()
        {
            SenderId = senderId,
            RecipientId = recipientId,
            Text = text.Trim(),
        };

    public void MarkRead()
    {
        if (ReadAt is not null) return;
        ReadAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
