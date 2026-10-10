using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibraryBreak : BaseEntity
{
    public Guid LibraryId { get; private set; }
    public Guid SessionId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string MemberName { get; private set; } = "";
    public string Type { get; private set; } = "short";
    public DateTime StartTime { get; private set; }
    public DateTime ExpectedReturnAt { get; private set; }
    public DateTime GraceUntil { get; private set; }
    public DateTime? EndTime { get; private set; }
    public bool SeatHeld { get; private set; } = true;
    public string? Seat { get; private set; }
    public string Status { get; private set; } = "active";

    public static LibraryBreak Create(
        Guid libraryId, Guid sessionId, Guid? participantId, string memberName, string type,
        string? seat, int durationMinutes, int graceMinutes)
    {
        var now = DateTime.UtcNow;
        return new()
        {
            LibraryId = libraryId,
            SessionId = sessionId,
            ParticipantId = participantId,
            MemberName = memberName.Trim(),
            Type = type,
            Seat = seat,
            SeatHeld = true,
            StartTime = now,
            ExpectedReturnAt = now.AddMinutes(durationMinutes),
            GraceUntil = now.AddMinutes(durationMinutes + graceMinutes),
            Status = "active",
        };
    }

    public void End() { Status = "ended"; EndTime = DateTime.UtcNow; UpdatedAt = DateTime.UtcNow; }
    public void Expire() { Status = "expired"; EndTime = DateTime.UtcNow; SeatHeld = false; UpdatedAt = DateTime.UtcNow; }
}
