namespace Nexora.Application.Common.Interfaces;

public record FacilityDoorTriggerRequest(
    Guid DeviceId,
    string DeviceName,
    string Direction,
    string? IpAddress,
    int Port,
    string? Username,
    string? Password,
    int RelayNo,
    int RelayMs,
    string? HttpPath,
    bool TriggerLockOnSuccess,
    string? WebhookUrl = null);

public record FacilityDoorTriggerResult(bool Opened, string? ErrorCode, string? ErrorMessage)
{
    public static FacilityDoorTriggerResult Success() => new(true, null, null);
    public static FacilityDoorTriggerResult Failure(string code, string message) => new(false, code, message);
}

public interface IFacilityDoorController
{
    Task<FacilityDoorTriggerResult> TriggerAsync(FacilityDoorTriggerRequest request, CancellationToken ct = default);
}
