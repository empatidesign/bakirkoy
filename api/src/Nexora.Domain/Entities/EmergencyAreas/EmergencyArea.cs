using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.EmergencyAreas;

public class EmergencyArea : BaseEntity
{
    public string Name { get; private set; } = "";
    public string Neighborhood { get; private set; } = "";
    public string Address { get; private set; } = "";
    public double? Latitude { get; private set; }
    public double? Longitude { get; private set; }
    public int Capacity { get; private set; }
    public int AreaSizeM2 { get; private set; }
    public EmergencyEquipment Equipment { get; private set; } = new();

    public Guid? ManagerId { get; private set; }
    public string Manager { get; private set; } = "";
    public string? ManagerPhone { get; private set; }
    public string? ManagerEmail { get; private set; }
    public string? ManagerRoleKey { get; private set; }
    public string? ManagerRoleName { get; private set; }
    public string? EmergencyPhone { get; private set; }

    public string? Description { get; private set; }
    public EmergencyAreaStatus Status { get; private set; }

    // Dış kaynaktan (AFAD/Netcad GIS) senkronize edilen kayıtlar. Elle girilen kayıtlarda null kalır.
    public string? ExternalSource { get; private set; }
    public long? ExternalId { get; private set; }
    public DateTime? ExternalSyncedAt { get; private set; }

    public static EmergencyArea Create(string name, string neighborhood, string address)
        => new()
        {
            Name = name.Trim(),
            Neighborhood = neighborhood.Trim(),
            Address = address.Trim(),
            Status = EmergencyAreaStatus.Active,
        };

    public void SetBasics(string name, string neighborhood, string address, double? latitude, double? longitude, int capacity, int areaSizeM2, string? description)
    {
        Name = name.Trim();
        Neighborhood = neighborhood.Trim();
        Address = address.Trim();
        Latitude = latitude;
        Longitude = longitude;
        Capacity = capacity;
        AreaSizeM2 = areaSizeM2;
        Description = description;
    }

    public void SetEquipment(EmergencyEquipment equipment) => Equipment = equipment;

    public void SetManager(Guid? managerId, string manager, string? managerPhone, string? managerEmail, string? roleKey, string? roleName)
    {
        ManagerId = managerId;
        Manager = manager.Trim();
        ManagerPhone = managerPhone;
        ManagerEmail = managerEmail;
        ManagerRoleKey = roleKey;
        ManagerRoleName = roleName;
    }

    public void SetEmergencyPhone(string? emergencyPhone) => EmergencyPhone = emergencyPhone;

    public void SetStatus(EmergencyAreaStatus status) => Status = status;

    public void MarkSynced(string source, long externalId, DateTime syncedAtUtc)
    {
        ExternalSource = source;
        ExternalId = externalId;
        ExternalSyncedAt = syncedAtUtc;
    }
}
