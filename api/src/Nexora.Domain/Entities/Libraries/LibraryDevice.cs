using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Libraries;

public record LibraryDeviceData(
    string Name,
    string Direction,
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
    string OperationMode = "directional",
    int ToggleCooldownMinutes = 5
);

public class LibraryDevice : BaseEntity
{
    public Guid LibraryId { get; private set; }
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
    public bool IsActive { get; private set; } = true;
    public string? CreatedBy { get; private set; }
    public string? DeletedBy { get; private set; }

    public string OperationMode { get; private set; } = "directional";

    public int ToggleCooldownMinutes { get; private set; } = 5;

    public static LibraryDevice Create(Guid libraryId, LibraryDeviceData d, string deviceCode, string? apiKey, string? actor)
    {
        var device = new LibraryDevice { LibraryId = libraryId, DeviceCode = deviceCode, ApiKey = apiKey, CreatedBy = actor };
        device.Apply(d);
        return device;
    }

    public void Update(LibraryDeviceData d) { Apply(d); UpdatedAt = DateTime.UtcNow; }

    private void Apply(LibraryDeviceData d)
    {
        Name = d.Name.Trim();
        Direction = d.Direction is "entry" or "exit" ? d.Direction : "entry";
        DeviceId = string.IsNullOrWhiteSpace(d.DeviceId) ? null : d.DeviceId.Trim();
        IpAddress = string.IsNullOrWhiteSpace(d.IpAddress) ? null : d.IpAddress.Trim();
        Port = d.Port <= 0 ? 80 : d.Port;
        Username = d.Username;
        Password = d.Password;
        RelayNo = d.RelayNo <= 0 ? 1 : d.RelayNo;
        RelayMs = d.RelayMs <= 0 ? 3000 : d.RelayMs;
        WorkMode = d.WorkMode is "online" or "offline" ? d.WorkMode : "online";
        HttpPath = d.HttpPath;
        TriggerLockOnSuccess = d.TriggerLockOnSuccess;
        OperationMode = d.OperationMode is "toggle" ? "toggle" : "directional";
        ToggleCooldownMinutes = d.ToggleCooldownMinutes <= 0 ? 5 : d.ToggleCooldownMinutes;
    }

    public void RotateKey(string apiKey) { ApiKey = apiKey; UpdatedAt = DateTime.UtcNow; }
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;

    public void MoveToLibrary(Guid libraryId) { LibraryId = libraryId; UpdatedAt = DateTime.UtcNow; }

    public void MarkDeleted(string? actor) { IsDeleted = true; DeletedAt = DateTime.UtcNow; DeletedBy = actor; }
}
