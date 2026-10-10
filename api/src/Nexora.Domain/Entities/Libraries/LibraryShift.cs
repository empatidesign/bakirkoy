using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class LibraryShift : BaseEntity
{
    public Guid StaffId { get; private set; }
    public string StaffName { get; private set; } = "";
    public Guid LibraryId { get; private set; }
    public string LibraryName { get; private set; } = "";
    public DateTime StartTime { get; private set; }
    public DateTime? EndTime { get; private set; }
    public int? WorkedMinutes { get; private set; }
    public string Status { get; private set; } = "active";
    public string InitiationType { get; private set; } = "admin";
    public Guid? InitiatedById { get; private set; }
    public string? InitiatedByName { get; private set; }
    public string? Location { get; private set; }
    public string? Notes { get; private set; }
    public string? IpAddress { get; private set; }
    public bool EndedByIpTakeover { get; private set; }

    public bool AutoClosedAtCutoff { get; private set; }

    public DateTime? OriginalStartTime { get; private set; }
    public DateTime? OriginalEndTime { get; private set; }
    public Guid? LastEditedById { get; private set; }
    public string? LastEditedByName { get; private set; }
    public DateTime? LastEditedAt { get; private set; }
    public string? EditReason { get; private set; }
    public bool WasEdited { get; private set; }

    public static LibraryShift Start(Guid staffId, string staffName, Guid libraryId, string libraryName, string initiationType, Guid? initiatedById, string? initiatedByName, string? location, string? notes, string? ipAddress = null)
        => new()
        {
            StaffId = staffId,
            StaffName = staffName,
            LibraryId = libraryId,
            LibraryName = libraryName,
            StartTime = DateTime.UtcNow,
            Status = "active",
            InitiationType = initiationType is "self" or "ip-auto" or "door-qr" ? initiationType : "admin",
            InitiatedById = initiatedById,
            InitiatedByName = string.IsNullOrWhiteSpace(initiatedByName) ? null : initiatedByName,
            Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim(),
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            IpAddress = string.IsNullOrWhiteSpace(ipAddress) ? null : ipAddress.Trim(),
        };

    public void End()
    {
        EndTime = DateTime.UtcNow;
        WorkedMinutes = (int)Math.Max(0, (EndTime.Value - StartTime).TotalMinutes);
        Status = "ended";
    }

    public void EndByIpTakeover()
    {
        EndTime = DateTime.UtcNow;
        WorkedMinutes = (int)Math.Max(0, (EndTime.Value - StartTime).TotalMinutes);
        Status = "ended";
        EndedByIpTakeover = true;
    }

    public void AutoCloseAtCutoff(DateTime cutoffUtc)
    {
        EndTime = cutoffUtc;
        WorkedMinutes = (int)Math.Max(0, (EndTime.Value - StartTime).TotalMinutes);
        Status = "ended";
        AutoClosedAtCutoff = true;
    }

    public void Edit(DateTime newStart, DateTime newEnd, Guid? editorId, string? editorName, string? reason)
    {
        if (newEnd <= newStart)
            throw new InvalidOperationException("Çıkış saati giriş saatinden sonra olmalıdır.");

        if (!WasEdited)
        {
            OriginalStartTime = StartTime;
            OriginalEndTime = EndTime;
        }

        StartTime = newStart;
        EndTime = newEnd;
        WorkedMinutes = (int)Math.Max(0, (newEnd - newStart).TotalMinutes);
        Status = "ended";
        LastEditedById = editorId;
        LastEditedByName = string.IsNullOrWhiteSpace(editorName) ? null : editorName;
        LastEditedAt = DateTime.UtcNow;
        EditReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        WasEdited = true;
    }

    // Kod denetimi 2026-08-08 (kullanıcı isteği: mesai sistemi derin denetim) — "aktif mesainin
    // şu ana kadarki süresi ne kadar" hesabı LibraryShiftService içinde üç ayrı yerde
    // (GetStaffPeriodTotalsAsync, GetLeaderboardAsync, GetReportSummaryAsync) tekrarlanan yerel
    // fonksiyonlarla yapılıyordu (DRY ihlali, tutarsızlık riski). Tek doğru kaynak burası:
    // aktif bir mesai için "şu ana kadar" geçen süre, bitmiş bir mesai için kayıtlı
    // WorkedMinutes.
    public int EffectiveWorkedMinutes(DateTime nowUtc)
        => Status == "active" ? (int)Math.Max(0, (nowUtc - StartTime).TotalMinutes) : WorkedMinutes ?? 0;
}
