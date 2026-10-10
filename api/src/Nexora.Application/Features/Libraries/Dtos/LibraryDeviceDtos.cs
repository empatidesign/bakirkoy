namespace Nexora.Application.Features.Libraries.Dtos;

public record LibraryDeviceDto(
    Guid Id, Guid LibraryId, string Name, string Direction, string? DeviceId,
    string? IpAddress, int Port, string? Username, bool HasPassword,
    int RelayNo, int RelayMs, string WorkMode, string? HttpPath,
    bool TriggerLockOnSuccess, string DeviceCode, string? ApiKey, bool IsActive, DateTime CreatedAt,
    string OperationMode, int ToggleCooldownMinutes,
    DateTime? LastSeenAt = null, bool IsOnline = false);

public record CreateLibraryDeviceRequest(
    string Name, string Direction, string? DeviceId, string? IpAddress, int? Port,
    string? Username, string? Password, int? RelayNo, int? RelayMs,
    string WorkMode, string? HttpPath, bool TriggerLockOnSuccess = true,
    string OperationMode = "directional", int? ToggleCooldownMinutes = 5);

public record UpdateLibraryDeviceRequest(
    string Name, string Direction, string? DeviceId, string? IpAddress, int? Port,
    string? Username, string? Password, int? RelayNo, int? RelayMs,
    string WorkMode, string? HttpPath, bool TriggerLockOnSuccess = true,
    string OperationMode = "directional", int? ToggleCooldownMinutes = 5);

public record LibraryDeviceTestResultDto(bool Ok, string Message);

public record MoveLibraryDeviceRequest(Guid TargetLibraryId);
