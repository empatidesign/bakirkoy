using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibraryQueueEntry : BaseEntity
{
    public Guid LibraryId { get; private set; }
    public string QueueNumber { get; private set; } = "";
    public Guid? ParticipantId { get; private set; }
    public string MemberName { get; private set; } = "";
    public string Tckn { get; private set; } = "";
    public string Phone { get; private set; } = "";
    public DateTime? BirthDate { get; private set; }
    public string? GuardianPhone { get; private set; }
    public string Method { get; private set; } = "manual";
    public string Status { get; private set; } = "waiting";
    public DateTime JoinedAt { get; private set; }
    public DateTime? CalledAt { get; private set; }
    public DateTime? CountdownExpiresAt { get; private set; }

    public static LibraryQueueEntry Create(
        Guid libraryId, string queueNumber, Guid? participantId, string memberName, string tckn,
        string phone, DateTime? birthDate, string? guardianPhone, string method)
        => new()
        {
            LibraryId = libraryId,
            QueueNumber = queueNumber,
            ParticipantId = participantId,
            MemberName = memberName.Trim(),
            Tckn = tckn,
            Phone = phone,
            BirthDate = birthDate,
            GuardianPhone = guardianPhone,
            Method = method,
            Status = "waiting",
            JoinedAt = DateTime.UtcNow,
        };

    public void Call(int windowMinutes)
    {
        Status = "called";
        CalledAt = DateTime.UtcNow;
        CountdownExpiresAt = DateTime.UtcNow.AddMinutes(windowMinutes);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Enter() { Status = "entered"; UpdatedAt = DateTime.UtcNow; }
    public void Expire() { Status = "expired"; UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
}
