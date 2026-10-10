using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public class TravelAttendance : BaseEntity
{
    public Guid TravelId { get; private set; }
    public Guid ApplicationId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public string Status { get; private set; } = "absent";
    public string Method { get; private set; } = "roster";
    public DateTime MarkedAt { get; private set; }
    public string? MarkedBy { get; private set; }

    public static TravelAttendance Create(Guid travelId, Guid applicationId, Guid? participantId,
        string fullName, string tckn, string status, string method, string? actor)
        => new()
        {
            TravelId = travelId,
            ApplicationId = applicationId,
            ParticipantId = participantId,
            FullName = fullName.Trim(),
            Tckn = tckn,
            Status = status,
            Method = method,
            MarkedAt = DateTime.UtcNow,
            MarkedBy = actor,
        };

    public void SetStatus(string status, string method, string? actor)
    {
        Status = status;
        Method = method;
        MarkedAt = DateTime.UtcNow;
        MarkedBy = actor;
        UpdatedAt = DateTime.UtcNow;
    }
}
