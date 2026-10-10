namespace Nexora.Application.Features.DeviceMonitor.Dtos;

public record DeviceMonitorItemDto(
    string Id,
    string Source,
    string Name,
    string Direction,
    string? DeviceCode,
    string? DeviceId,
    bool IsActive,
    bool IsOnline,
    DateTime? LastSeenAt,
    string ParentId,
    string ParentName,
    string? ParentModule = null,
    string? OperationMode = null);

public record DeviceMonitorSnapshotDto(
    List<DeviceMonitorItemDto> Devices,
    int OnlineCount,
    int OfflineCount,
    DateTime GeneratedAt);

public record DeviceScanEventDto(
    string DeviceId,
    string Source,
    string Direction,
    bool Success,
    string? Message,
    DateTime At,
    string? FacilityName = null,
    string? PersonName = null);
