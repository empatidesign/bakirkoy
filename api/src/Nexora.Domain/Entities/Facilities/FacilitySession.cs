using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public class FacilitySession : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public Guid FacilityId { get; private set; }
    public Guid GroupId { get; private set; }
    public DateTime Date { get; private set; }
    public string Day { get; private set; } = string.Empty;
    public string StartTime { get; private set; } = string.Empty;
    public string EndTime { get; private set; } = string.Empty;
    public DateTime? AttendanceTakenAt { get; private set; }
    public DateTime? AttendanceReminderSentAt { get; private set; }
    public DateTime? ParticipantReminderSentAt { get; private set; }
    public bool IsCancelled { get; private set; }
    public string? CancelReason { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public static FacilitySession Create(string module, Guid facilityId, Guid groupId, DateTime date, string day, string startTime, string endTime, string? actor)
    {
        return new FacilitySession
        {
            Module = module,
            FacilityId = facilityId,
            GroupId = groupId,
            Date = date.Date,
            Day = day,
            StartTime = startTime,
            EndTime = endTime,
            CreatedBy = actor,
        };
    }

    public void MarkAttendanceTaken() => AttendanceTakenAt = DateTime.UtcNow;
    public void MarkReminderSent() => AttendanceReminderSentAt = DateTime.UtcNow;
    public void MarkParticipantReminderSent() => ParticipantReminderSentAt = DateTime.UtcNow;

    /// <summary>Cancels the session. Returns false (no-op) if already cancelled, so callers can skip
    /// re-sending cancellation notifications/SMS to participants on repeated calls.</summary>
    public bool Cancel(string? reason)
    {
        if (IsCancelled) return false;
        IsCancelled = true;
        CancelReason = reason;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    /// <summary>Reopens the session. Returns false (no-op) if already open, so callers can skip
    /// re-sending reopen notifications on repeated calls.</summary>
    public bool Reopen()
    {
        if (!IsCancelled) return false;
        IsCancelled = false;
        CancelReason = null;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }
}
