using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public class TravelApplicationPassenger : BaseEntity
{
    public Guid ApplicationId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public string Gender { get; private set; } = "mixed";
    public Guid? BusId { get; private set; }
    public string? SeatNumber { get; private set; }
    public bool IsPrimary { get; private set; }
    public string Status { get; private set; } = "active";

    public static TravelApplicationPassenger Create(
        Guid applicationId, Guid participantId, string gender,
        Guid? busId, string? seatNumber, bool isPrimary)
        => new()
        {
            ApplicationId = applicationId,
            ParticipantId = participantId,
            Gender = string.IsNullOrWhiteSpace(gender) ? "mixed" : gender,
            BusId = busId,
            SeatNumber = string.IsNullOrWhiteSpace(seatNumber) ? null : seatNumber,
            IsPrimary = isPrimary,
            Status = "active",
        };

    public void AssignSeat(Guid? busId, string? seatNumber)
    {
        BusId = busId;
        SeatNumber = string.IsNullOrWhiteSpace(seatNumber) ? null : seatNumber;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetGender(string gender) => Gender = string.IsNullOrWhiteSpace(gender) ? "mixed" : gender;

    public void Cancel()
    {
        Status = "cancelled";
        BusId = null;
        SeatNumber = null;
        UpdatedAt = DateTime.UtcNow;
    }
}
