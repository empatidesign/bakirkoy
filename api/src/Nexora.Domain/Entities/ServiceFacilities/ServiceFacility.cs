using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.ServiceFacilities;

public class ServiceFacility : BaseEntity
{
    public string Name { get; private set; } = "";
    public string Type { get; private set; } = "";
    public FacilityStatus Status { get; private set; }
    public FacilityLocationType LocationType { get; private set; }
    public FacilityOutdoorCategory? OutdoorCategory { get; private set; }
    public int? AreaSizeM2 { get; private set; }
    public string? Description { get; private set; }
    public string? About { get; private set; }

    public string City { get; private set; } = "";
    public string District { get; private set; } = "";
    public string Address { get; private set; } = "";
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }

    public Guid? ManagerId { get; private set; }
    public string Manager { get; private set; } = "";
    public string? ManagerPhone { get; private set; }
    public string? ManagerEmail { get; private set; }
    public string? ManagerRoleKey { get; private set; }
    public string? ManagerRoleName { get; private set; }
    public string? EmergencyPhone { get; private set; }
    public string? Website { get; private set; }
    public string? Facebook { get; private set; }
    public string? Instagram { get; private set; }
    public string? Twitter { get; private set; }

    public string WeekdayOpen { get; private set; } = "";
    public string WeekdayClose { get; private set; } = "";
    public string WeekendOpen { get; private set; } = "";
    public string WeekendClose { get; private set; } = "";

    public List<string> Facilities { get; private set; } = [];
    public List<string> AccessibilityFeatures { get; private set; } = [];
    public int ParkingCapacity { get; private set; }
    public FacilityParkingType ParkingType { get; private set; }
    public int? Capacity { get; private set; }

    public List<ServiceOfferingItem> OfferedServices { get; private set; } = [];
    public int ServiceCount { get; private set; }
    public List<FacilityImageItem> Images { get; private set; } = [];

    public bool MasterQrEnabled { get; private set; }
    public string? MasterCardCodeHash { get; private set; }
    public DateTime? MasterCardCodeUpdatedAt { get; private set; }

    public void SetMasterQrEnabled(bool enabled)
    {
        MasterQrEnabled = enabled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RotateMasterCardCode(string? hash)
    {
        MasterCardCodeHash = hash;
        MasterCardCodeUpdatedAt = hash is null ? null : DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public static ServiceFacility Create(string name, string type, FacilityLocationType locationType)
        => new()
        {
            Name = name.Trim(),
            Type = type,
            LocationType = locationType,
            Status = FacilityStatus.Active,
        };

    public void SetBasics(string name, string type, FacilityLocationType locationType, FacilityOutdoorCategory? outdoorCategory, int? areaSizeM2, string? description, string? about)
    {
        Name = name.Trim();
        Type = type;
        LocationType = locationType;
        OutdoorCategory = locationType == FacilityLocationType.Outdoor ? outdoorCategory : null;
        AreaSizeM2 = locationType == FacilityLocationType.Outdoor ? areaSizeM2 : null;
        Description = description;
        About = about;
    }

    public void SetLocation(string city, string district, string address, double? latitude, double? longitude)
    {
        City = city.Trim();
        District = district.Trim();
        Address = address.Trim();
        Latitude = latitude;
        Longitude = longitude;
    }

    public void SetManager(Guid? managerId, string manager, string? managerPhone, string? managerEmail, string? roleKey, string? roleName)
    {
        ManagerId = managerId;
        Manager = manager.Trim();
        ManagerPhone = managerPhone;
        ManagerEmail = managerEmail;
        ManagerRoleKey = roleKey;
        ManagerRoleName = roleName;
    }

    public void SetContact(string? emergencyPhone, string? website, string? facebook, string? instagram, string? twitter)
    {
        EmergencyPhone = emergencyPhone;
        Website = website;
        Facebook = facebook;
        Instagram = instagram;
        Twitter = twitter;
    }

    public void SetHours(string? weekdayOpen, string? weekdayClose, string? weekendOpen, string? weekendClose)
    {
        WeekdayOpen = weekdayOpen ?? "";
        WeekdayClose = weekdayClose ?? "";
        WeekendOpen = weekendOpen ?? "";
        WeekendClose = weekendClose ?? "";
    }

    public void SetFeatures(List<string> facilities, List<string> accessibilityFeatures, int parkingCapacity, FacilityParkingType parkingType, int? capacity)
    {
        Facilities = facilities;
        AccessibilityFeatures = accessibilityFeatures;
        ParkingCapacity = parkingCapacity;
        ParkingType = parkingType;
        Capacity = capacity;
    }

    public void SetOfferedServices(List<ServiceOfferingItem> services)
    {
        OfferedServices = services;
        ServiceCount = services.Count;
    }

    public void SetImages(List<FacilityImageItem> images) => Images = images;

    public void SetStatus(FacilityStatus status) => Status = status;
}
