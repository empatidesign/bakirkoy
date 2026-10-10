using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public static class LibrarySessionStatus
{
    public const string Inside = "inside";
    public const string OnBreakShort = "on_break_short";
    public const string OnBreakLong = "on_break_long";
    public const string BreakExpired = "break_expired";
    public const string ExitPending = "exit_pending";
    public const string Completed = "completed";
    public const string NoShow = "no_show";
    public const string StaffClosed = "staff_closed";
    public const string DeviceError = "device_error";

    public static readonly string[] ActiveStatuses =
        [Inside, OnBreakShort, OnBreakLong, BreakExpired, ExitPending];

    public static bool IsActive(string status) => System.Array.IndexOf(ActiveStatuses, status) >= 0;
    public static bool IsOnBreak(string status) => status is OnBreakShort or OnBreakLong;
}

public class LibrarySession : BaseEntity
{
    public Guid LibraryId { get; private set; }
    public Guid? ParticipantId { get; private set; }
    public string MemberName { get; private set; } = "";
    public string Tckn { get; private set; } = "";
    public string? Phone { get; private set; }
    public DateTime? BirthDate { get; private set; }
    public string? GuardianPhone { get; private set; }
    public string? Seat { get; private set; }
    public DateTime EntryTime { get; private set; }
    public DateTime? ExitTime { get; private set; }
    public string Status { get; private set; } = LibrarySessionStatus.Inside;
    public int ShortBreaksUsed { get; private set; }
    public int LongBreaksUsed { get; private set; }
    public Guid? ReservationId { get; private set; }
    public DateTime? PendingExitAt { get; private set; }
    public bool IsExitNoShow { get; private set; }

    public string? PendingAction { get; private set; }
    public string EntryMethod { get; private set; } = "manual";
    public bool PointsAwarded { get; private set; }

    public bool IsOnBreak => LibrarySessionStatus.IsOnBreak(Status);

    public static LibrarySession Create(
        Guid libraryId, Guid? participantId, string memberName, string tckn,
        string? phone, DateTime? birthDate, string? guardianPhone, string? seat, Guid? reservationId, string entryMethod = "manual")
        => new()
        {
            LibraryId = libraryId,
            ParticipantId = participantId,
            MemberName = memberName.Trim(),
            Tckn = tckn,
            Phone = phone,
            BirthDate = birthDate,
            GuardianPhone = guardianPhone,
            Seat = seat,
            ReservationId = reservationId,
            EntryTime = DateTime.UtcNow,
            Status = LibrarySessionStatus.Inside,
            EntryMethod = entryMethod == "qr" ? "qr" : "manual",
        };

    public void MarkPointsAwarded() { PointsAwarded = true; UpdatedAt = DateTime.UtcNow; }

    public void StartBreak(string type)
    {
        if (type == "long") { Status = LibrarySessionStatus.OnBreakLong; LongBreaksUsed++; }
        else { Status = LibrarySessionStatus.OnBreakShort; ShortBreaksUsed++; }
        UpdatedAt = DateTime.UtcNow;
    }

    public void EndBreak() { Status = LibrarySessionStatus.Inside; UpdatedAt = DateTime.UtcNow; }

    public void MarkBreakExpired() { Status = LibrarySessionStatus.BreakExpired; UpdatedAt = DateTime.UtcNow; }

    public void ChangeSeat(string? seat) { Seat = seat; UpdatedAt = DateTime.UtcNow; }

    public void Exit(bool auto)
    {
        Status = auto ? LibrarySessionStatus.NoShow : LibrarySessionStatus.Completed;
        ExitTime = DateTime.UtcNow;
        PendingExitAt = null;
        if (auto) IsExitNoShow = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void CloseByStaff()
    {
        Status = LibrarySessionStatus.StaffClosed;
        ExitTime = DateTime.UtcNow;
        PendingExitAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkDeviceError()
    {
        Status = LibrarySessionStatus.DeviceError;
        ExitTime = DateTime.UtcNow;
        PendingExitAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RegisterExitIntent()
    {
        PendingExitAt = DateTime.UtcNow;
        PendingAction = "exit";
        Status = LibrarySessionStatus.ExitPending;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RegisterBreakIntent(string type)
    {
        PendingAction = type == "long" ? "long_break" : "short_break";
        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearPendingAction()
    {
        PendingAction = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearExitIntent()
    {
        PendingExitAt = null;
        if (PendingAction == "exit") PendingAction = null;
        if (Status == LibrarySessionStatus.ExitPending) Status = LibrarySessionStatus.Inside;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ExitAsNoShow()
    {
        Status = LibrarySessionStatus.NoShow;
        ExitTime = DateTime.UtcNow;
        PendingExitAt = null;
        IsExitNoShow = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReleaseSeatOnExitTimeout()
    {
        Seat = null;
        PendingExitAt = null;
        IsExitNoShow = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
