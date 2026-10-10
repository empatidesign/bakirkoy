using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Reviews;

public class TravelReview : BaseEntity
{
    public Guid TravelId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public int Rating { get; private set; }
    public string? Comment { get; private set; }

    public static TravelReview Create(Guid travelId, Guid participantId, int rating, string? comment)
        => new() { TravelId = travelId, ParticipantId = participantId, Rating = rating, Comment = comment?.Trim() };
}
