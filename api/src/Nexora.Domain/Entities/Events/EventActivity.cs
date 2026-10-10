using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Events;

public class EventActivity : BaseEntity
{
    public string Kind { get; private set; } = "check_in";
    public DateTime At { get; private set; }
    public Guid EventId { get; private set; }
    public Guid? SessionId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string ParticipantName { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public string Method { get; private set; } = "QR";
    public string Status { get; private set; } = string.Empty;
    public bool WalkIn { get; private set; }
    public int PointsAwarded { get; private set; }

    public static EventActivity Create(
        string kind, DateTime at, Guid eventId, Guid? sessionId, Guid? participantId,
        string participantName, string tckn, string method, string status, bool walkIn, int pointsAwarded)
        => new()
        {
            Kind = kind,
            At = at,
            EventId = eventId,
            SessionId = sessionId,
            ParticipantId = participantId,
            ParticipantName = participantName,
            Tckn = tckn,
            Method = method,
            Status = status,
            WalkIn = walkIn,
            PointsAwarded = pointsAwarded < 0 ? 0 : pointsAwarded,
        };
}
