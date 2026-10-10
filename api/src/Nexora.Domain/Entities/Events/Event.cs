using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Events;

public record EventData(
    string Name,
    Guid CategoryId,
    string VenueType,
    Guid? FacilityId,
    Guid? HallId,
    string? LocationJson,
    DateTime StartDate,
    DateTime EndDate,
    bool IsSingleDay,
    string Gender,
    int Capacity,
    int ReserveCapacity,
    int MinAge,
    int MaxAge,
    string ParticipationPeriod,
    int ParticipationLimit,
    string Description,
    string InternalNote,
    string ImagesJson,
    string AccessJson,
    string PricingJson,
    string PointsJson,
    bool IsActive,
    bool SultangaziResidentOnly,
    string? StartTime,
    string? EndTime,
    string? ResidencyMode = null,
    DateTime? ApplicationStartDate = null,
    DateTime? ApplicationEndDate = null,
    // Kullanıcı isteği (2026-09-20): Gezi (Travel) modülündeki CrewJson/sorumlu ataması
    // deseninin Etkinlik Takvimi karşılığı — "Etkinlik Sorumlusu" atandığında kendi
    // etkinliğiyle sınırlı erişim (scoped) hesap açılabiliyor. null/boş = sorumlu atanmadı.
    string? ResponsibleJson = null
);

public class Event : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public string VenueType { get; private set; } = "indoor";
    public Guid? FacilityId { get; private set; }
    public Guid? HallId { get; private set; }
    public string? LocationJson { get; private set; }
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public bool IsSingleDay { get; private set; } = true;
    public string? StartTime { get; private set; }
    public string? EndTime { get; private set; }
    public string Gender { get; private set; } = "mixed";
    public int Capacity { get; private set; }
    public int ReserveCapacity { get; private set; }
    public int MinAge { get; private set; }
    public int MaxAge { get; private set; }
    public string ParticipationPeriod { get; private set; } = "none";
    public int ParticipationLimit { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string InternalNote { get; private set; } = string.Empty;
    public string ImagesJson { get; private set; } = "{}";
    public string AccessJson { get; private set; } = "{}";
    public string PricingJson { get; private set; } = "{}";
    public string PointsJson { get; private set; } = "{}";
    public bool IsActive { get; private set; } = true;
    public bool SultangaziResidentOnly { get; private set; }
    public string ResidencyMode { get; private set; } = "anyone";
    public int RegisteredCount { get; private set; }
    public int ReserveCount { get; private set; }
    public int SessionCount { get; private set; }
    public string? SessionScheduleJson { get; private set; }
    public string? SeatStatesJson { get; private set; }
    public bool RequiresResidence { get; private set; }
    public DateTime? ApplicationStartDate { get; private set; }
    public DateTime? ApplicationEndDate { get; private set; }
    public string? ResponsibleJson { get; private set; }
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    // Kullanıcı isteği (2026-10-06): "QR okutma kütüphanelerde/tesislerde olduğu gibi cihazlı veya
    // cihazsız çalışsın, aynı mantık her yerde geçerli olsun". Cihazlı turnike zaten FacilityDevice
    // (Scope=Event, Hall'a bağlı) ile çalışıyordu — eksik olan, Facility/Library'deki "sabit
    // (duvar) QR'ı vatandaş kendi telefonuyla okutur" akışının etkinlik karşılığıydı. Bu alanlar
    // Facility.cs/Library.cs'deki StaticQr* alanlarıyla BİREBİR aynı isim/anlam/davranışa sahiptir.
    public bool StaticQrEnabled { get; private set; }
    public string? StaticQrCode { get; private set; }
    public string StaticQrMode { get; private set; } = "attendance";
    public int StaticQrMinExitSeconds { get; private set; } = 3;
    public int StaticQrReentryCooldownSeconds { get; private set; }

    public void SetStaticQrEnabled(bool enabled)
    {
        StaticQrEnabled = enabled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStaticQrMode(string mode)
    {
        StaticQrMode = mode is "attendance" or "entry" or "entry_exit" or "split" ? mode : "attendance";
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetStaticQrTiming(int minExitSeconds, int reentryCooldownSeconds)
    {
        StaticQrMinExitSeconds = minExitSeconds < 0 ? 0 : minExitSeconds;
        StaticQrReentryCooldownSeconds = reentryCooldownSeconds < 0 ? 0 : reentryCooldownSeconds;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RotateStaticQrCode(string code)
    {
        StaticQrCode = code;
        UpdatedAt = DateTime.UtcNow;
    }

    public static Event Create(EventData d, string code, string? actor)
    {
        var ev = new Event { Code = code, CreatedBy = actor };
        ev.Apply(d);
        return ev;
    }

    public void Update(EventData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    public void SetSessionSchedule(string? json) => SessionScheduleJson = json;

    private void Apply(EventData d)
    {
        Name = d.Name.Trim();
        CategoryId = d.CategoryId;
        VenueType = d.VenueType;
        FacilityId = d.FacilityId;
        HallId = d.HallId;
        LocationJson = d.LocationJson;
        StartDate = d.StartDate;
        EndDate = d.IsSingleDay ? d.StartDate : d.EndDate;
        IsSingleDay = d.IsSingleDay;
        StartTime = d.StartTime;
        EndTime = d.EndTime;
        Gender = string.IsNullOrWhiteSpace(d.Gender) ? "mixed" : d.Gender;
        Capacity = d.Capacity < 0 ? 0 : d.Capacity;
        ReserveCapacity = d.ReserveCapacity < 0 ? 0 : d.ReserveCapacity;
        MinAge = d.MinAge < 0 ? 0 : d.MinAge;
        MaxAge = d.MaxAge < 0 ? 0 : d.MaxAge;
        ParticipationPeriod = string.IsNullOrWhiteSpace(d.ParticipationPeriod) ? "none" : d.ParticipationPeriod;
        ParticipationLimit = d.ParticipationLimit < 0 ? 0 : d.ParticipationLimit;
        Description = d.Description ?? string.Empty;
        InternalNote = d.InternalNote ?? string.Empty;
        ImagesJson = string.IsNullOrWhiteSpace(d.ImagesJson) ? "{}" : d.ImagesJson;
        AccessJson = string.IsNullOrWhiteSpace(d.AccessJson) ? "{}" : d.AccessJson;
        PricingJson = string.IsNullOrWhiteSpace(d.PricingJson) ? "{}" : d.PricingJson;
        PointsJson = string.IsNullOrWhiteSpace(d.PointsJson) ? "{}" : d.PointsJson;
        IsActive = d.IsActive;
        var mode = string.IsNullOrWhiteSpace(d.ResidencyMode)
            ? (d.SultangaziResidentOnly ? "sultangazi_only" : "anyone")
            : d.ResidencyMode;
        ResidencyMode = mode is "sultangazi_only" or "outside_only" or "anyone" or "foreign_only" or "tc_only" or "sultangazi_tc" or "sultangazi_foreign"
            ? mode : "anyone";
        SultangaziResidentOnly = ResidencyMode == "sultangazi_only";
        ApplicationStartDate = d.ApplicationStartDate;
        ApplicationEndDate = d.ApplicationEndDate;
        ResponsibleJson = d.ResponsibleJson;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void SetSessionCount(int count) => SessionCount = count < 0 ? 0 : count;

    public void SetResponsibleJson(string? json, string? actor)
    {
        ResponsibleJson = json;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    public void SetSeatStates(string? json) => SeatStatesJson = json;

    public void SetCapacity(int capacity) => Capacity = capacity < 0 ? 0 : capacity;

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
