namespace Nexora.Application.Features.DevicePermissions.Dtos;

public static class PermissionStatuses
{
    public const string NotAsked = "not_asked";
    public const string Granted = "granted";
    public const string Denied = "denied";
    public const string Unsupported = "unsupported";

    public static readonly string[] All = [NotAsked, Granted, Denied, Unsupported];

    public static bool IsValid(string status) => All.Contains(status);
}

public record DevicePermissionDto(
    string LocationStatus,
    string NotificationStatus,
    double? Latitude,
    double? Longitude,
    DateTime? LocationUpdatedAt,
    bool HasPushToken,
    string? DevicePlatform,
    DateTime? RespondedAt,
    bool HasResponded);

public record SaveDevicePermissionRequest(
    string? LocationStatus,
    string? NotificationStatus,
    double? Latitude,
    double? Longitude,
    string? PushToken,
    string? DevicePlatform);
