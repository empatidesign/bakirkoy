using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.DutyPharmacies;

public class DutyPharmacy : BaseEntity
{
    public long Sicil { get; private set; }
    public string Name { get; private set; } = "";
    public string? Phone { get; private set; }
    public string? Directions { get; private set; }
    public string? Address { get; private set; }
    public string? Neighborhood { get; private set; }
    public string District { get; private set; } = "Sultangazi";
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public string? DutyEndTime { get; private set; }

    public DateOnly DutyDate { get; private set; }
    public DateTime SyncedAt { get; private set; }

    public static DutyPharmacy Create(
        long sicil, string name, string? phone, string? directions, string? address,
        string? neighborhood, double? latitude, double? longitude, string? dutyEndTime,
        DateOnly dutyDate)
        => new()
        {
            Sicil = sicil,
            Name = name.Trim(),
            Phone = NullIfEmpty(phone),
            Directions = NullIfEmpty(directions),
            Address = NullIfEmpty(address),
            Neighborhood = NullIfEmpty(neighborhood),
            Latitude = latitude,
            Longitude = longitude,
            DutyEndTime = NullIfEmpty(dutyEndTime),
            DutyDate = dutyDate,
            SyncedAt = DateTime.UtcNow,
        };

    public void UpdateFromSync(
        string name, string? phone, string? directions, string? address,
        string? neighborhood, double? latitude, double? longitude, string? dutyEndTime,
        DateOnly dutyDate)
    {
        Name = name.Trim();
        Phone = NullIfEmpty(phone);
        Directions = NullIfEmpty(directions);
        Address = NullIfEmpty(address);
        Neighborhood = NullIfEmpty(neighborhood);
        Latitude = latitude;
        Longitude = longitude;
        DutyEndTime = NullIfEmpty(dutyEndTime);
        DutyDate = dutyDate;
        SyncedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? NullIfEmpty(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
