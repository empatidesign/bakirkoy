using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public class TravelApplication : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public Guid TravelId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public DateTime ApplicationDate { get; private set; }
    public string Status { get; private set; } = "pending";
    public string? RejectionReason { get; private set; }
    public string DocumentStatus { get; private set; } = "pending";
    public string PaymentStatus { get; private set; } = "pending";
    public Guid? BusId { get; private set; }
    public string? SeatNumber { get; private set; }
    public string Notes { get; private set; } = string.Empty;
    public string? EmergencyContactName { get; private set; }
    public string? EmergencyContactPhone { get; private set; }
    public string? AppliedBy { get; private set; }

    public bool IsGuest { get; private set; }
    public Guid? BroughtByParticipantId { get; private set; }
    public string? GuestFullName { get; private set; }
    public string? GuestTckn { get; private set; }
    public DateTime? GuestBirthDate { get; private set; }
    public string? GuestPhone { get; private set; }
    public string? GuestEmail { get; private set; }
    public string? GuestGender { get; private set; }

    public ICollection<TravelApplicationPassenger> Passengers { get; private set; } = [];

    public static TravelApplication Create(
        Guid travelId, Guid participantId,
        string status, string documentStatus, string paymentStatus,
        Guid? busId, string? seatNumber,
        string notes, string code, string? actor)
        => new()
        {
            Code = code,
            TravelId = travelId,
            ParticipantId = participantId,
            ApplicationDate = DateTime.UtcNow,
            Status = string.IsNullOrWhiteSpace(status) ? "pending" : status,
            DocumentStatus = string.IsNullOrWhiteSpace(documentStatus) ? "pending" : documentStatus,
            PaymentStatus = string.IsNullOrWhiteSpace(paymentStatus) ? "pending" : paymentStatus,
            BusId = busId,
            SeatNumber = string.IsNullOrWhiteSpace(seatNumber) ? null : seatNumber,
            Notes = notes ?? string.Empty,
            AppliedBy = actor,
        };

    public static TravelApplication CreateGuest(
        Guid travelId, Guid broughtByParticipantId,
        string fullName, string tckn, DateTime birthDate, string phone, string email, string gender,
        Guid? busId, string? seatNumber, string code, string? actor)
        => new()
        {
            Code = code,
            TravelId = travelId,
            ParticipantId = broughtByParticipantId,
            BroughtByParticipantId = broughtByParticipantId,
            IsGuest = true,
            GuestFullName = fullName.Trim(),
            GuestTckn = tckn.Trim(),
            GuestBirthDate = DateTime.SpecifyKind(birthDate, DateTimeKind.Utc),
            GuestPhone = phone.Trim(),
            GuestEmail = email.Trim(),
            GuestGender = gender is "male" or "female" ? gender : "male",
            ApplicationDate = DateTime.UtcNow,
            Status = "pending",
            DocumentStatus = "pending",
            PaymentStatus = "pending",
            BusId = busId,
            SeatNumber = string.IsNullOrWhiteSpace(seatNumber) ? null : seatNumber,
            Notes = string.Empty,
            AppliedBy = actor,
        };

    public void Update(
        string status, string documentStatus, string paymentStatus,
        Guid? busId, string? seatNumber, string notes)
    {
        Status = string.IsNullOrWhiteSpace(status) ? "pending" : status;
        DocumentStatus = string.IsNullOrWhiteSpace(documentStatus) ? "pending" : documentStatus;
        PaymentStatus = string.IsNullOrWhiteSpace(paymentStatus) ? "pending" : paymentStatus;
        BusId = busId;
        SeatNumber = string.IsNullOrWhiteSpace(seatNumber) ? null : seatNumber;
        Notes = notes ?? string.Empty;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status, string? rejectionReason = null)
    {
        Status = string.IsNullOrWhiteSpace(status) ? "pending" : status;
        RejectionReason = Status == "rejected" && !string.IsNullOrWhiteSpace(rejectionReason) ? rejectionReason.Trim() : null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetDocumentStatus(string status)
    {
        DocumentStatus = string.IsNullOrWhiteSpace(status) ? "none" : status;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AssignSeat(Guid? busId, string? seatNumber)
    {
        BusId = busId;
        SeatNumber = string.IsNullOrWhiteSpace(seatNumber) ? null : seatNumber;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetEmergencyContact(string? name, string? phone)
    {
        EmergencyContactName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        EmergencyContactPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
    }

    public void AddPassenger(TravelApplicationPassenger passenger) => Passengers.Add(passenger);

    public void ClearPassengers() => Passengers.Clear();
}
