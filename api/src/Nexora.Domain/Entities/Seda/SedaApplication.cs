using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Seda;

public class SedaApplication : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public string StudentName { get; private set; } = string.Empty;
    public string StudentSurname { get; private set; } = string.Empty;
    public string Tckn { get; private set; } = string.Empty;
    public DateTime? BirthDate { get; private set; }
    public string SchoolName { get; private set; } = string.Empty;
    public string NextYearGrade { get; private set; } = string.Empty;
    public string EducationType { get; private set; } = string.Empty;
    public string ExamCenterName { get; private set; } = string.Empty;
    public string StudentPhone { get; private set; } = string.Empty;
    public string ParentPhone { get; private set; } = string.Empty;
    public string Neighborhood { get; private set; } = string.Empty;
    public string Address { get; private set; } = string.Empty;
    public string Status { get; private set; } = "pending";
    public string? Notes { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime? ReviewedAt { get; private set; }
    public string? ReviewedBy { get; private set; }
    public string? AppliedBy { get; private set; }
    public Guid? CitizenUserId { get; private set; }
    public Guid? PeriodId { get; private set; }

    public static SedaApplication Create(
        string code, string studentName, string studentSurname, string tckn, DateTime? birthDate,
        string schoolName, string nextYearGrade, string educationType, string examCenterName,
        string studentPhone, string parentPhone, string neighborhood, string address, string status, string? notes, string? actor,
        Guid? citizenUserId = null, Guid? periodId = null)
        => new()
        {
            Code = code,
            StudentName = studentName,
            StudentSurname = studentSurname,
            Tckn = tckn,
            BirthDate = birthDate,
            SchoolName = schoolName,
            NextYearGrade = nextYearGrade,
            EducationType = educationType,
            ExamCenterName = examCenterName,
            StudentPhone = studentPhone,
            ParentPhone = parentPhone,
            Neighborhood = neighborhood,
            Address = address,
            Status = status,
            Notes = notes,
            AppliedBy = actor,
            CitizenUserId = citizenUserId,
            PeriodId = periodId,
        };

    public void Update(
        string studentName, string studentSurname, string tckn, DateTime? birthDate,
        string schoolName, string nextYearGrade, string educationType, string examCenterName,
        string studentPhone, string parentPhone, string neighborhood, string address, string status, string? notes)
    {
        StudentName = studentName;
        StudentSurname = studentSurname;
        Tckn = tckn;
        BirthDate = birthDate;
        SchoolName = schoolName;
        NextYearGrade = nextYearGrade;
        EducationType = educationType;
        ExamCenterName = examCenterName;
        StudentPhone = studentPhone;
        ParentPhone = parentPhone;
        Neighborhood = neighborhood;
        Address = address;
        Status = status;
        Notes = notes;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStatus(string status, string? reviewer, string? rejectionReason = null)
    {
        Status = status;
        RejectionReason = status == "rejected"
            ? (string.IsNullOrWhiteSpace(rejectionReason) ? null : rejectionReason.Trim())
            : null;
        ReviewedAt = DateTime.UtcNow;
        ReviewedBy = reviewer;
        UpdatedAt = DateTime.UtcNow;
    }
}
