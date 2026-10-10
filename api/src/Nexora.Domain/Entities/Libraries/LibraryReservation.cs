using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibraryReservation : BaseEntity
{
    public Guid LibraryId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string MemberName { get; private set; } = "";
    public string Tckn { get; private set; } = "";
    public string Phone { get; private set; } = "";
    public DateTime? BirthDate { get; private set; }
    public string? GuardianPhone { get; private set; }
    public string? Seat { get; private set; }
    public DateTime ReservedAt { get; private set; }
    public DateTime? SlotStart { get; private set; }
    public DateTime? SlotEnd { get; private set; }
    public DateTime HoldUntil { get; private set; }
    public string Status { get; private set; } = "held";
    public bool IsWalkIn { get; private set; }

    public static LibraryReservation Create(
        Guid libraryId, Guid? participantId, string memberName, string tckn, string phone,
        DateTime? birthDate, string? guardianPhone, string? seat, DateTime? slotStart, DateTime? slotEnd, int holdWindowMinutes,
        bool isWalkIn = false)
    {
        var now = DateTime.UtcNow;
        return new()
        {
            LibraryId = libraryId,
            ParticipantId = participantId,
            MemberName = memberName.Trim(),
            Tckn = tckn,
            Phone = phone,
            BirthDate = birthDate,
            GuardianPhone = guardianPhone,
            Seat = seat,
            ReservedAt = now,
            SlotStart = slotStart,
            SlotEnd = slotEnd,
            HoldUntil = now.AddMinutes(holdWindowMinutes),
            Status = "held",
            IsWalkIn = isWalkIn,
        };
    }

    public void Consume() { Status = "consumed"; UpdatedAt = DateTime.UtcNow; }
    public void Cancel() { Status = "cancelled"; UpdatedAt = DateTime.UtcNow; }
    public void Expire() { Status = "expired"; UpdatedAt = DateTime.UtcNow; }
}
