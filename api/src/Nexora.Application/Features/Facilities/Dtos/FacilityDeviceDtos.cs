namespace Nexora.Application.Features.Facilities.Dtos;

public record FacilityDeviceDto(
    Guid Id,
    string Module,
    Guid? ServiceFacilityId,
    Guid? FacilityId,
    string Scope,
    Guid? HallId,
    string Name,
    string Direction,
    string? DeviceId,
    string? IpAddress,
    int Port,
    string? Username,
    bool HasPassword,
    int RelayNo,
    int RelayMs,
    string WorkMode,
    string? HttpPath,
    bool TriggerLockOnSuccess,
    string DeviceCode,
    string? ApiKey,
    string? Description,
    bool IsActive,
    DateTime CreatedAt,
    Guid? GroupId = null,
    string? GroupName = null
);

public record CreateFacilityDeviceRequest(
    string Name,
    string Direction,
    string? Scope,
    Guid? ServiceFacilityId,
    Guid? FacilityId,
    Guid? HallId,
    string? DeviceId,
    string? IpAddress,
    int Port = 80,
    string? Username = null,
    string? Password = null,
    int RelayNo = 1,
    int RelayMs = 3000,
    string WorkMode = "online",
    string? HttpPath = null,
    bool TriggerLockOnSuccess = true,
    string? Description = null,
    Guid? GroupId = null
);

public record UpdateFacilityDeviceRequest(
    string Name,
    string Direction,
    string? Scope,
    Guid? HallId,
    string? DeviceId,
    string? IpAddress,
    int Port = 80,
    string? Username = null,
    string? Password = null,
    int RelayNo = 1,
    int RelayMs = 3000,
    string WorkMode = "online",
    string? HttpPath = null,
    bool TriggerLockOnSuccess = true,
    string? Description = null,
    Guid? GroupId = null
);

public record CreateHallDeviceRequest(
    string Name,
    string Direction,
    string? DeviceId,
    string? IpAddress,
    int Port = 80,
    string? Username = null,
    string? Password = null,
    int RelayNo = 1,
    int RelayMs = 3000,
    string WorkMode = "online",
    string? HttpPath = null,
    bool TriggerLockOnSuccess = true,
    string? Description = null
);

public record FacilityDeviceTestResultDto(bool Ok, string Message);

public record FacilityDeviceOpenResultDto(bool Opened, bool Queued, string Message);
