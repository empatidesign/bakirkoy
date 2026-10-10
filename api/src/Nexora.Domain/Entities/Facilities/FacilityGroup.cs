using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public record FacilityGroupData(
    string Module,
    Guid FacilityId,
    Guid BranchId,
    Guid? ParentGroupId,
    string Name,
    string Type,
    string Gender,
    int Capacity,
    int ReserveCapacity,
    int AgeMin,
    int AgeMax,
    string ScheduleJson,
    string AttendanceMode,
    string FeeJson,
    string ConditionsJson,
    DateTime? PeriodStart,
    DateTime? PeriodEnd,
    int AbsenceLimit,
    int ConsecutiveAbsenceLimit,
    int EntryGraceMinutes,
    Guid? InstructorId,
    string? InstructorName,
    bool IsActive,
    string? Description,
    string PeriodType,
    int PeriodCount,
    int PeriodMonths,
    DateTime? ApplicationStartDate,
    DateTime? ApplicationEndDate,
    bool AcademyWhitelistEnabled,
    bool AutoApprove,
    bool AttendanceLimitOverride,
    string AttendanceLimitType,
    int AttendanceLimitCount,
    string PeriodUnit = "month",
    int PeriodDays = 0,
    string? ResidencyMode = null,
    bool LateTrackingEnabled = true,
    string? EntitlementModel = null
);

public class FacilityGroup : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public Guid FacilityId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? ParentGroupId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Type { get; private set; } = "kurs";
    public string Gender { get; private set; } = "mixed";
    public int Capacity { get; private set; }
    public int ReserveCapacity { get; private set; }
    public int AgeMin { get; private set; }
    public int AgeMax { get; private set; }
    public string ScheduleJson { get; private set; } = "[]";
    public string AttendanceMode { get; private set; } = "full";
    public string FeeJson { get; private set; } = "{}";
    public string ConditionsJson { get; private set; } = "{}";
    public DateTime? PeriodStart { get; private set; }
    public DateTime? PeriodEnd { get; private set; }
    public int AbsenceLimit { get; private set; }
    public int ConsecutiveAbsenceLimit { get; private set; }
    public int EntryGraceMinutes { get; private set; }
    public Guid? InstructorId { get; private set; }
    public string? InstructorName { get; private set; }
    public string PeriodType { get; private set; } = "date_range";
    public int PeriodCount { get; private set; }
    public int PeriodMonths { get; private set; }
    public string PeriodUnit { get; private set; } = "month";
    public int PeriodDays { get; private set; }
    public string EntitlementModel { get; private set; } = FacilityEntitlementModel.FixedCalendar;
    // Kullanıcı isteği: Başvuru kriterlerine "Sultangazi'de ikamet eden T.C. vatandaşları",
    // "Sultangazi'de ikamet eden yabancılar", "T.C. vatandaşları", "Yabancılar" seçenekleri
    // eklenmeli — eski tek-eksen model (sultangazi_only/foreign_only) uyruk (TC/Yabancı) ile
    // ikamet (Sultangazi/serbest) eksenlerini ayıramıyordu (örn. "Sultangazi'de ikamet eden
    // yabancılar" hiç ifade edilemiyordu). Değerler:
    // "anyone": kısıtlama yok.
    // "sultangazi_only": Sultangazi ikametgahı şart, uyruk fark etmez (geriye dönük uyumluluk).
    // "foreign_only": yalnızca yabancı uyruklu, ikamet fark etmez (geriye dönük uyumluluk).
    // "tc_only": yalnızca T.C. vatandaşları, ikamet fark etmez.
    // "sultangazi_tc": Sultangazi'de ikamet eden T.C. vatandaşları.
    // "sultangazi_foreign": Sultangazi'de ikamet eden yabancılar.
    // "outside_only": yalnızca Sultangazi dışında ikamet edenler (UAT 2026-09-24, diğer modüllerle eşitlendi).
    public string ResidencyMode { get; private set; } = "anyone";
    // Kullanıcı isteği: "Geç Gelme Takibi" — kapalıysa "Geç Geldi" seçeneği yoklama ekranında hiç
    // gösterilmesin ve backend "late" durumunu kabul etmesin (sadece Geldi/Gelmedi kalsın).
    public bool LateTrackingEnabled { get; private set; } = true;
    public DateTime? ApplicationStartDate { get; private set; }
    public DateTime? ApplicationEndDate { get; private set; }
    public bool AcademyWhitelistEnabled { get; private set; }
    public string AcademyWhitelistTcknsJson { get; private set; } = "[]";
    public bool AutoApprove { get; private set; } = true;
    public bool AttendanceLimitOverride { get; private set; }
    public string AttendanceLimitType { get; private set; } = "unlimited";
    public int AttendanceLimitCount { get; private set; }
    public int RegisteredCount { get; private set; }
    public int WaitlistCount { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    // Kullanıcı isteği (2026-10-05): "gruplar/seanslar ada göre, eklenme tarihine göre veya
    // manuel sürükle-bırak ile sıralanabilsin" — bkz. Facility.SortOrder ile aynı desen.
    // Ana gruplarda (ParentGroupId=null) ve her grubun kendi seanslarında (ParentGroupId=o
    // grup) bağımsız bir sıralama alanı olarak kullanılır.
    public int SortOrder { get; private set; }

    public void SetSortOrder(int order)
    {
        SortOrder = order < 0 ? 0 : order;
        UpdatedAt = DateTime.UtcNow;
    }

    public static FacilityGroup Create(FacilityGroupData d, string? actor, int sortOrder = 0)
    {
        var group = new FacilityGroup { CreatedBy = actor, SortOrder = sortOrder };
        group.Apply(d);
        return group;
    }

    public void Update(FacilityGroupData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    private void Apply(FacilityGroupData d)
    {
        Module = d.Module;
        FacilityId = d.FacilityId;
        BranchId = d.BranchId;
        ParentGroupId = d.ParentGroupId;
        Name = d.Name.Trim();
        Description = string.IsNullOrWhiteSpace(d.Description) ? null : d.Description.Trim();
        Type = d.Type;
        Gender = d.Gender;
        Capacity = d.Capacity < 0 ? 0 : d.Capacity;
        ReserveCapacity = d.ReserveCapacity < 0 ? 0 : d.ReserveCapacity;
        AgeMin = d.AgeMin < 0 ? 0 : d.AgeMin;
        AgeMax = d.AgeMax < 0 ? 0 : d.AgeMax;
        ScheduleJson = string.IsNullOrWhiteSpace(d.ScheduleJson) ? "[]" : d.ScheduleJson;
        AttendanceMode = d.AttendanceMode;
        FeeJson = string.IsNullOrWhiteSpace(d.FeeJson) ? "{}" : d.FeeJson;
        ConditionsJson = string.IsNullOrWhiteSpace(d.ConditionsJson) ? "{}" : d.ConditionsJson;
        PeriodUnit = d.PeriodUnit == "day" ? "day" : "month";
        PeriodDays = d.PeriodDays < 0 ? 0 : d.PeriodDays;
        PeriodStart = d.PeriodStart;
        PeriodEnd = PeriodUnit == "day" && PeriodDays > 0 && d.PeriodStart.HasValue
            ? d.PeriodStart.Value.Date.AddDays(PeriodDays - 1)
            : d.PeriodEnd;
        AbsenceLimit = d.AbsenceLimit < 0 ? 0 : d.AbsenceLimit;
        ConsecutiveAbsenceLimit = d.ConsecutiveAbsenceLimit < 0 ? 0 : d.ConsecutiveAbsenceLimit;
        EntryGraceMinutes = d.EntryGraceMinutes < 0 ? 0 : d.EntryGraceMinutes;
        InstructorId = d.InstructorId;
        InstructorName = d.InstructorName;
        PeriodType = string.IsNullOrWhiteSpace(d.PeriodType) ? "date_range" : d.PeriodType;
        PeriodCount = d.PeriodCount < 0 ? 0 : d.PeriodCount;
        PeriodMonths = d.PeriodMonths < 0 ? 0 : d.PeriodMonths;
        EntitlementModel = FacilityEntitlementModel.Normalize(d.EntitlementModel, PeriodType);
        ApplicationStartDate = d.ApplicationStartDate;
        ApplicationEndDate = d.ApplicationEndDate;
        AcademyWhitelistEnabled = d.AcademyWhitelistEnabled;
        AutoApprove = d.AutoApprove;
        AttendanceLimitOverride = d.AttendanceLimitOverride;
        AttendanceLimitType = string.IsNullOrWhiteSpace(d.AttendanceLimitType) ? "unlimited" : d.AttendanceLimitType;
        AttendanceLimitCount = d.AttendanceLimitCount;
        IsActive = d.IsActive;
        // Tek kaynak: EligibilityRules (diğer modüllerle aynı 7 seçenek, "outside_only" dahil).
        ResidencyMode = Nexora.Domain.Common.EligibilityRules.NormalizeResidencyMode(d.ResidencyMode);
        LateTrackingEnabled = d.LateTrackingEnabled;
    }

    public void SetAcademyWhitelist(string? json)
    {
        AcademyWhitelistTcknsJson = string.IsNullOrWhiteSpace(json) ? "[]" : json;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetCounts(int registered, int waitlist)
    {
        RegisteredCount = registered < 0 ? 0 : registered;
        WaitlistCount = waitlist < 0 ? 0 : waitlist;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void ExtendPeriodEnd(DateTime periodEnd)
    {
        if (PeriodEnd is null || periodEnd.Date > PeriodEnd.Value.Date)
            PeriodEnd = periodEnd.Date;
    }

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }
}
