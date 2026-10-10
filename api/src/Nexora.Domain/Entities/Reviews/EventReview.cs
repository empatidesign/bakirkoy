using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Reviews;

public class EventReview : BaseEntity
{
    public Guid EventId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public int Rating { get; private set; }
    public string? Comment { get; private set; }

    public static EventReview Create(Guid eventId, Guid participantId, int rating, string? comment)
        => new() { EventId = eventId, ParticipantId = participantId, Rating = rating, Comment = comment?.Trim() };
}
