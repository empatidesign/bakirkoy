using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public class Library : BaseEntity
{
    public string Name { get; private set; } = "";
    public string? Description { get; private set; }
    public string? ImageUrl { get; private set; }

    public Guid ServiceFacilityId { get; private set; }
    public string? ServiceFacilityName { get; private set; }
    public string? City { get; private set; }
    public string? District { get; private set; }
    public string? Address { get; private set; }

    public Guid? ManagerId { get; private set; }
    public string ManagerName { get; private set; } = "";
    public string? ManagerPhone { get; private set; }
    public string? ManagerEmail { get; private set; }
    public string? ManagerRoleKey { get; private set; }
    public string? ManagerRoleName { get; private set; }
    public string? EmergencyPhone { get; private set; }

    public string SeatingMode { get; private set; } = "masali";
    public string AreaType { get; private set; } = "mixed";
    public int Capacity { get; private set; }
    public int FloorCount { get; private set; }
    public bool IsMultiFloor { get; private set; }
    public string? LayoutJson { get; private set; }
    public string? KrokiUrl { get; private set; }

    public string AccessType { get; private set; } = "qr";
    public string? DeviceKind { get; private set; }

    public bool QueueEnabled { get; private set; } = true;
    public bool ReservationEnabled { get; private set; }
    public bool DeviceControlEnabled { get; private set; }
    public string EntryControlMode { get; private set; } = "qr";
    public string ExitControlMode { get; private set; } = "qr";

    public bool IsOpenType => AccessType == "open";
    public bool RequiresQr => AccessType is "qr" or "device";
    public bool TriggersDevice => AccessType == "device";

    public List<string> Amenities { get; private set; } = [];

    public bool IpRestrictionEnabled { get; private set; }
    public List<string> AllowedIps { get; private set; } = [];

    public bool GeofenceEnabled { get; private set; }
    public double? GeofenceLatitude { get; private set; }
    public double? GeofenceLongitude { get; private set; }
    public int GeofenceRadiusMeters { get; private set; } = 150;

    public string? SeatStatesJson { get; private set; }

    public bool IsActive { get; private set; } = true;

    public string? OperationTemplate { get; private set; }

    public bool StaticQrEnabled { get; private set; }
    public string? StaticQrCode { get; private set; }
    public string StaticQrMode { get; private set; } = "attendance";
    // Kullanıcı isteği (2026-09-29, revize akşam: "dakika bekleme olayını kaldır, saniye cinsinden
    // olsun, hızlı olsun"): Facility.StaticQrMinExitSeconds/ReentryCooldownSeconds ile eşdeğer —
    // "attendance"/"entry_exit" (tek-QR) modunda ilk okutma GİRİŞ sayılır; bu süre dolana kadar
    // tekrar tekrar okutmak yeni giriş/çıkış üretmez. Süre dolduktan SONRAKİ ilk okutma ÇIKIŞ
    // sayılır. split modda (ayrı Giriş/Çıkış QR) da reentry-cooldown aynı şekilde uygulanır.
    public int StaticQrMinExitSeconds { get; private set; } = 3;
    // Çıkıştan sonra aynı kişinin tekrar GİRİŞ sayılabilmesi için beklemesi gereken süre (saniye).
    // Varsayılan KAPALI (0) — dakikalarca bekletme kaldırıldı, admin panelden açılabilir.
    public int StaticQrReentryCooldownSeconds { get; private set; }
    public string ResidencyMode { get; private set; } = "anyone";

    public void SetResidencyMode(string? mode) => ResidencyMode = Nexora.Domain.Common.EligibilityRules.NormalizeResidencyMode(mode);

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

    public static Library Create(string name, Guid serviceFacilityId)
        => new() { Name = name.Trim(), ServiceFacilityId = serviceFacilityId, IsActive = true };

    public void SetOperationTemplate(string? template)
    {
        OperationTemplate = template;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetBasics(string name, string? description)
    {
        Name = name.Trim();
        Description = description;
    }

    public void SetFacility(Guid serviceFacilityId, string? facilityName, string? city, string? district, string? address)
    {
        ServiceFacilityId = serviceFacilityId;
        ServiceFacilityName = facilityName;
        City = city;
        District = district;
        Address = address;
    }

    public void SetManager(Guid? managerId, string managerName, string? phone, string? email, string? roleKey, string? roleName, string? emergencyPhone)
    {
        ManagerId = managerId;
        ManagerName = managerName.Trim();
        ManagerPhone = phone;
        ManagerEmail = email;
        ManagerRoleKey = roleKey;
        ManagerRoleName = roleName;
        EmergencyPhone = emergencyPhone;
    }

    public void SetSeating(string seatingMode, int capacity, int floorCount, bool isMultiFloor, string? layoutJson)
    {
        SeatingMode = seatingMode;
        Capacity = capacity;
        FloorCount = floorCount;
        IsMultiFloor = isMultiFloor;
        LayoutJson = layoutJson;
    }

    public void SetAreaType(string areaType)
        => AreaType = areaType is "study" or "silent" or "mixed" ? areaType : "mixed";

    public void SetOperation(bool queueEnabled, bool reservationEnabled, string entryControlMode, string exitControlMode, bool deviceControlEnabled)
    {
        QueueEnabled = queueEnabled;
        ReservationEnabled = reservationEnabled;
        DeviceControlEnabled = deviceControlEnabled;

        if (AccessType == "open")
        {
            EntryControlMode = "none";
            ExitControlMode = "none";
            return;
        }

        EntryControlMode = string.IsNullOrWhiteSpace(entryControlMode) ? "qr" : entryControlMode;
        ExitControlMode = string.IsNullOrWhiteSpace(exitControlMode) ? "qr" : exitControlMode;
    }

    public void SetAccessType(string accessType, string? deviceKind)
    {
        AccessType = accessType is "open" or "qr" or "device" ? accessType : "qr";
        if (AccessType == "device")
        {
            DeviceKind = deviceKind is "turnstile" or "magnetic" ? deviceKind : "turnstile";
            DeviceControlEnabled = true;
        }
        else if (AccessType == "qr")
        {
            DeviceKind = null;
            DeviceControlEnabled = false;
        }
        else
        {
            DeviceKind = null;
            DeviceControlEnabled = false;
            EntryControlMode = "none";
            ExitControlMode = "none";
            QueueEnabled = false;
            ReservationEnabled = false;
        }
    }

    public void SetAmenities(List<string> amenities) => Amenities = amenities;

    public void SetSecurity(bool ipRestrictionEnabled, List<string> allowedIps)
    {
        IpRestrictionEnabled = ipRestrictionEnabled;
        AllowedIps = allowedIps;
    }

    public void SetGeofence(bool enabled, double? latitude, double? longitude, int radiusMeters)
    {
        GeofenceEnabled = enabled && latitude.HasValue && longitude.HasValue;
        GeofenceLatitude = latitude;
        GeofenceLongitude = longitude;
        GeofenceRadiusMeters = radiusMeters > 0 ? radiusMeters : 150;
    }

    public void SetKroki(string? krokiUrl) => KrokiUrl = krokiUrl;

    public void SetImageUrl(string? imageUrl) => ImageUrl = imageUrl;

    public void SetSeatStates(string? seatStatesJson) => SeatStatesJson = seatStatesJson;

    public void SetStatus(bool active) => IsActive = active;
}
