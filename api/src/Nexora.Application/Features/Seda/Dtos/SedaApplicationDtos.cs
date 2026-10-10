namespace Nexora.Application.Features.Seda.Dtos;

public record SedaApplicationDto(
    Guid Id,
    string Code,
    string StudentName,
    string StudentSurname,
    string Tckn,
    DateTime? BirthDate,
    string SchoolName,
    string NextYearGrade,
    string EducationType,
    string ExamCenterName,
    string StudentPhone,
    string ParentPhone,
    string Neighborhood,
    string Address,
    string Status,
    string? Notes,
    string? RejectionReason,
    DateTime AppliedAt,
    string? AppliedBy,
    DateTime? ReviewedAt,
    string? ReviewedBy,
    /// <summary>
    /// Vatandaşın bu başvuruyu kendi iptal edip edemeyeceği. Yalnızca "pending"
    /// durumdaki başvurular iptal edilebilir; değerlendirmesi bitmiş kayıtlar
    /// için karar kurumundur. Admin uçlarında anlamsız olduğundan varsayılan false.
    /// </summary>
    bool CanCancel = false
);

public record SedaApplicationSummaryDto(int Total, int Approved, int Pending, int Rejected);

public record SedaApplicationListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? EducationType { get; init; }
    public string? Grade { get; init; }
    public string? Grades { get; init; }
    public List<string> GradeList => Grades?.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(g => g.Trim()).ToList() ?? [];
    public string? ExamCenterName { get; init; }
    public string? SchoolName { get; init; }
    public DateTime? StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record SedaApplicationFormRequest(
    string StudentName,
    string StudentSurname,
    string Tckn,
    string? BirthDate,
    string SchoolName,
    string NextYearGrade,
    string EducationType,
    string ExamCenterName,
    string StudentPhone,
    string ParentPhone,
    string? Neighborhood,
    string Address,
    string Status,
    string? Notes
);

public record SetSedaApplicationStatusRequest(string Status, string? Reason = null);

public record SedaManualMessageRequest(
    string TemplateEvent,
    string? CustomText,
    bool Sms,
    bool Notify,
    List<string>? StatusFilter = null,
    string? SchoolName = null,
    string? SmsOtp = null
);

public record SedaManualMessageResultDto(int Recipients, int SmsSent, int NotificationsCreated, bool SmsMockMode);

public record CitizenSedaApplyRequest(
    string SchoolName,
    string NextYearGrade,
    string EducationType,
    string ExamCenterName,
    string? Notes
);

public record CitizenSedaOptionsDto(
    List<SedaOptionDto> Schools,
    List<SedaOptionDto> EducationTypes,
    List<SedaOptionDto> Grades,
    List<SedaOptionDto> ExamCenters
);

public record CitizenSedaInfoDto(
    bool ApplicationsOpen,
    bool RequireApproval,
    SedaPeriodDto? ActivePeriod
);

// Kullanıcı isteği (2026-10-05): eski sultanga_seda sisteminden (2018-2026, 60.623 başvuru)
// içe aktarılan tarihsel veri + bugünden sonraki yeni başvurular için "yıllara göre kaç kişi
// başvurmuş" detaylı rapor sistemi. Yıl, CreatedAt.Year üzerinden hesaplanır (içe aktarılan
// kayıtlarda CreatedAt = gerçek orijinal başvuru tarihi olacak şekilde set edilmiştir) — bu
// sayede ayrı bir "Yıl" alanına ihtiyaç duymadan hem eski hem yeni başvurular aynı rapor
// sorgusuna düşer.
public record SedaYearlyReportParams
{
    public string? SchoolName { get; init; }
    public string? Status { get; init; }
}

public record SedaYearlyCountDto(int Year, int Total, int Approved, int Pending, int Rejected);

public record SedaYearlyBreakdownItemDto(string Name, int Count);

public record SedaYearlyReportDto(
    List<SedaYearlyCountDto> ByYear,
    List<SedaYearlyBreakdownItemDto> TopSchools,
    List<SedaYearlyBreakdownItemDto> ByGrade,
    List<SedaYearlyBreakdownItemDto> ByEducationType,
    int TotalApplications,
    int TotalDistinctSchools,
    int TotalDistinctApplicants
);
