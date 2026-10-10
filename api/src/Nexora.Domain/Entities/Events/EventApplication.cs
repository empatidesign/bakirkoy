using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Events;

public class EventApplication : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public Guid EventId { get; private set; }
    public Guid? SessionId { get; private set; }
    public Guid ParticipantId { get; private set; }
    public DateTime ReferenceDate { get; private set; }
    public string Status { get; private set; } = "pending";
    public string? RejectionReason { get; private set; }
    public string DocumentStatus { get; private set; } = "missing";
    public string PaymentStatus { get; private set; } = "unpaid";
    public string? SeatNumber { get; private set; }
    public string? AppliedBy { get; private set; }
    public DateTime? Reminder24hSentAt { get; private set; }
    public DateTime? Reminder1hSentAt { get; private set; }

    public static EventApplication Create(
        Guid eventId, Guid? sessionId, Guid participantId, DateTime referenceDate,
        string status, string documentStatus, string paymentStatus,
        string code, string? actor)
        => new()
        {
            Code = code,
            EventId = eventId,
            SessionId = sessionId,
            ParticipantId = participantId,
            ReferenceDate = referenceDate.Date,
            Status = status,
            DocumentStatus = documentStatus,
            PaymentStatus = paymentStatus,
            AppliedBy = actor,
        };

    public void Update(
        Guid? sessionId, DateTime referenceDate, string status, string documentStatus, string paymentStatus)
    {
        SessionId = sessionId;
        ReferenceDate = referenceDate.Date;
        Status = status;
        DocumentStatus = documentStatus;
        PaymentStatus = paymentStatus;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status, string? rejectionReason = null)
    {
        Status = status;
        RejectionReason = status == "rejected" && !string.IsNullOrWhiteSpace(rejectionReason) ? rejectionReason.Trim() : null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AssignSeat(string? seatNumber) => SeatNumber = seatNumber;

    public void MarkReminder24hSent() => Reminder24hSentAt = DateTime.UtcNow;
    public void MarkReminder1hSent() => Reminder1hSentAt = DateTime.UtcNow;
}
