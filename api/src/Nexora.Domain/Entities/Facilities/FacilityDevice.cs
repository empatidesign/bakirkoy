using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Facilities;

public static class FacilityDeviceScope
{
    public const string FacilityGeneral = "facility_general";

    public const string Area = "area";

    public const string Event = "event";

    public static bool IsValid(string? s) => s is FacilityGeneral or Area or Event;
}

public record FacilityDeviceData(
    string Name,
    string Direction,
    string Scope,
    Guid? HallId,
    string? DeviceId,
    string? IpAddress,
    int Port,
    string? Username,
    string? Password,
    int RelayNo,
    int RelayMs,
    string WorkMode,
    string? HttpPath,
    bool TriggerLockOnSuccess,
    string? Description,
    Guid? GroupId = null
);

public class FacilityDevice : BaseEntity
{
    public string Module { get; private set; } = string.Empty;

    public Guid? ServiceFacilityId { get; private set; }

    public Guid? FacilityId { get; private set; }

    public string Scope { get; private set; } = FacilityDeviceScope.Area;

    public Guid? HallId { get; private set; }

    public Guid? GroupId { get; private set; }

    public string Name { get; private set; } = string.Empty;
    public string Direction { get; private set; } = "entry";

    public string? DeviceId { get; private set; }
    public string? IpAddress { get; private set; }
    public int Port { get; private set; } = 80;
    public string? Username { get; private set; }
    public string? Password { get; private set; }
    public int RelayNo { get; private set; } = 1;
    public int RelayMs { get; private set; } = 3000;
    public string WorkMode { get; private set; } = "online";
    public string? HttpPath { get; private set; }
    public bool TriggerLockOnSuccess { get; private set; } = true;

    public string DeviceCode { get; private set; } = string.Empty;
    public string? ApiKey { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public string Kind { get; private set; } = "turnstile";
    public string ConnectionModesJson { get; private set; } = "[]";
    public string? SerialNo { get; private set; }
    public string? WebhookUrl { get; private set; }

    public static FacilityDevice Create(string module, Guid? serviceFacilityId, Guid? facilityId, FacilityDeviceData d, string deviceCode, string? apiKey, string? actor)
    {
        var device = new FacilityDevice
        {
            Module = module,
            ServiceFacilityId = serviceFacilityId,
            FacilityId = facilityId,
            DeviceCode = deviceCode,
            ApiKey = apiKey,
            CreatedBy = actor,
        };
        device.Apply(d);
        return device;
    }

    public void Update(FacilityDeviceData d)
    {
        Apply(d);
        UpdatedAt = DateTime.UtcNow;
    }

    private void Apply(FacilityDeviceData d)
    {
        Name = d.Name.Trim();
        Direction = d.Direction is "entry" or "exit" or "both" ? d.Direction : "entry";
        Scope = FacilityDeviceScope.IsValid(d.Scope) ? d.Scope : FacilityDeviceScope.Area;
        HallId = Scope == FacilityDeviceScope.Event ? d.HallId : null;
        GroupId = Scope == FacilityDeviceScope.Area ? d.GroupId : null;
        DeviceId = string.IsNullOrWhiteSpace(d.DeviceId) ? null : d.DeviceId.Trim();
        SerialNo = DeviceId;
        IpAddress = string.IsNullOrWhiteSpace(d.IpAddress) ? null : d.IpAddress.Trim();
        Port = d.Port <= 0 ? 80 : d.Port;
        Username = d.Username;
        Password = d.Password;
        RelayNo = d.RelayNo <= 0 ? 1 : d.RelayNo;
        RelayMs = d.RelayMs <= 0 ? 3000 : d.RelayMs;
        WorkMode = d.WorkMode is "online" or "offline" ? d.WorkMode : "online";
        HttpPath = d.HttpPath;
        TriggerLockOnSuccess = d.TriggerLockOnSuccess;
        Description = d.Description;
    }

    public void RotateKey(string apiKey)
    {
        ApiKey = apiKey;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void MarkDeleted(string? actor)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = actor;
    }
}
