using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Travels;

public record TravelData(
    Guid RouteId,
    string Name,
    Guid CategoryId,
    string Destination,
    double? Latitude,
    double? Longitude,
    string Description,
    string Conditions,
    string InternalNote,
    DateTime StartDate,
    DateTime EndDate,
    DateTime RegistrationStartDate,
    DateTime RegistrationEndDate,
    string Gender,
    int MinAge,
    int MaxAge,
    int Capacity,
    int ReserveCapacity,
    string ParticipationPeriod,
    int ParticipationLimit,
    bool ExemptFromParticipationLimit,
    int CancellationDeadlineHours,
    string RestrictionsJson,
    string ImagesJson,
    string PricingJson,
    string PointsJson,
    string CrewJson,
    bool IsActive,
    bool SultangaziResidentOnly,
    string DeparturePoint = ""
);

public class Travel : BaseEntity
{
    public string Code { get; private set; } = string.Empty;
    public Guid RouteId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public Guid CategoryId { get; private set; }
    public string Destination { get; private set; } = string.Empty;
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string Conditions { get; private set; } = string.Empty;
    public string InternalNote { get; private set; } = string.Empty;
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public DateTime RegistrationStartDate { get; private set; }
    public DateTime RegistrationEndDate { get; private set; }
    public string Gender { get; private set; } = "mixed";
    public int MinAge { get; private set; }
    public int MaxAge { get; private set; }
    public int Capacity { get; private set; }
    public int ReserveCapacity { get; private set; }
    public string ParticipationPeriod { get; private set; } = "none";
    public int ParticipationLimit { get; private set; }
    /// <summary>
    /// Bu sefer, genel katılım sıklığı sınırından (dönem başına en fazla N gezi)
    /// muaf mı? true ise, bu sefere yapılan başvuru geçmiş/gelecek dönem sayımına
    /// dahil edilmez VE bu sefere başvururken kullanıcının o dönemki diğer gezi
    /// sayısı kontrol edilmez — "yıl içindeki hakkı 1 olsa da buna ayrıca katılabilir".
    /// </summary>
    public bool ExemptFromParticipationLimit { get; private set; }
    public int CancellationDeadlineHours { get; private set; } = 72;
    public string RestrictionsJson { get; private set; } = "{}";
    public string ImagesJson { get; private set; } = "{}";
    public string PricingJson { get; private set; } = "{}";
    public string PointsJson { get; private set; } = "{}";
    public string CrewJson { get; private set; } = "{}";
    public bool IsActive { get; private set; } = true;
    public bool SultangaziResidentOnly { get; private set; }
    public string DeparturePoint { get; private set; } = string.Empty;
    public int RegisteredCount { get; private set; }
    public int ReserveCount { get; private set; }
    public int BusCount { get; private set; }
    public string? CreatedBy { get; private set; }
    public string? UpdatedBy { get; private set; }
    public string? DeletedBy { get; private set; }
    public DateTime? AttendanceTakenAt { get; private set; }
    public DateTime? AttendanceReminderSentAt { get; private set; }

    public void MarkAttendanceTaken() => AttendanceTakenAt = DateTime.UtcNow;
    public void ReopenAttendance() => AttendanceTakenAt = null;
    public void MarkAttendanceReminderSent() => AttendanceReminderSentAt = DateTime.UtcNow;

    public static Travel Create(TravelData d, string code, string? actor)
    {
        var t = new Travel { Code = code, CreatedBy = actor };
        t.Apply(d);
        return t;
    }

    public void Update(TravelData d, string? actor)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    /// <summary>
    /// Route (Gezi) güncellendiğinde, ona bağlı bu Sefer'in denormalize edilmiş
    /// içerik kopyasını (isim, hedef, açıklama, kural, konum, yaş/cinsiyet kısıtı,
    /// kısıtlar, görsel, fiyat, puan, ikamet şartı) senkronize eder. Sefer'e özgü
    /// alanlara (tarih, kapasite, ekip, otobüs, durum) dokunmaz.
    /// </summary>
    public void SyncFromRoute(TravelRoute route)
    {
        Name = route.Name;
        CategoryId = route.CategoryId;
        Destination = route.Destination;
        Latitude = route.Latitude;
        Longitude = route.Longitude;
        Description = route.Description;
        Conditions = route.Conditions;
        InternalNote = route.InternalNote;
        Gender = route.Gender;
        MinAge = route.MinAge;
        MaxAge = route.MaxAge;
        RestrictionsJson = route.RestrictionsJson;
        ImagesJson = route.ImagesJson;
        PricingJson = route.PricingJson;
        PointsJson = route.PointsJson;
        SultangaziResidentOnly = route.SultangaziResidentOnly;
        DeparturePoint = route.DeparturePoint;
        UpdatedAt = DateTime.UtcNow;
    }

    private void Apply(TravelData d)
    {
        RouteId = d.RouteId;
        Name = d.Name.Trim();
        CategoryId = d.CategoryId;
        Destination = d.Destination?.Trim() ?? string.Empty;
        Latitude = d.Latitude;
        Longitude = d.Longitude;
        Description = d.Description ?? string.Empty;
        Conditions = d.Conditions ?? string.Empty;
        InternalNote = d.InternalNote ?? string.Empty;
        StartDate = DateTime.SpecifyKind(d.StartDate, DateTimeKind.Utc);
        EndDate = DateTime.SpecifyKind(d.EndDate, DateTimeKind.Utc);
        RegistrationStartDate = DateTime.SpecifyKind(d.RegistrationStartDate, DateTimeKind.Utc);
        RegistrationEndDate = DateTime.SpecifyKind(d.RegistrationEndDate, DateTimeKind.Utc);
        Gender = string.IsNullOrWhiteSpace(d.Gender) ? "mixed" : d.Gender;
        MinAge = d.MinAge < 0 ? 0 : d.MinAge;
        MaxAge = d.MaxAge < 0 ? 0 : d.MaxAge;
        Capacity = d.Capacity < 0 ? 0 : d.Capacity;
        ReserveCapacity = d.ReserveCapacity < 0 ? 0 : d.ReserveCapacity;
        ParticipationPeriod = string.IsNullOrWhiteSpace(d.ParticipationPeriod) ? "none" : d.ParticipationPeriod;
        ParticipationLimit = d.ParticipationLimit < 0 ? 0 : d.ParticipationLimit;
        ExemptFromParticipationLimit = d.ExemptFromParticipationLimit;
        CancellationDeadlineHours = d.CancellationDeadlineHours < 0 ? 0 : d.CancellationDeadlineHours;
        RestrictionsJson = string.IsNullOrWhiteSpace(d.RestrictionsJson) ? "{}" : d.RestrictionsJson;
        ImagesJson = string.IsNullOrWhiteSpace(d.ImagesJson) ? "{}" : d.ImagesJson;
        PricingJson = string.IsNullOrWhiteSpace(d.PricingJson) ? "{}" : d.PricingJson;
        PointsJson = string.IsNullOrWhiteSpace(d.PointsJson) ? "{}" : d.PointsJson;
        CrewJson = string.IsNullOrWhiteSpace(d.CrewJson) ? "{}" : d.CrewJson;
        IsActive = d.IsActive;
        SultangaziResidentOnly = d.SultangaziResidentOnly;
        DeparturePoint = d.DeparturePoint?.Trim() ?? string.Empty;
    }

    public void SetCrewJson(string crewJson, string? actor)
    {
        CrewJson = string.IsNullOrWhiteSpace(crewJson) ? "{}" : crewJson;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = actor;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void SetCounts(int registered, int reserve)
    {
        RegisteredCount = registered < 0 ? 0 : registered;
        ReserveCount = reserve < 0 ? 0 : reserve;
    }

    public void SetBusCount(int count) => BusCount = count < 0 ? 0 : count;

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
