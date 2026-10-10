namespace Nexora.Application.Common.Interfaces;

public record DoorTriggerRequest(
    Guid LibraryId,
    string DeviceKind,
    string Direction,
    Guid SessionId,
    string MemberName);

public record DoorTriggerResult(bool Opened, string? ErrorCode, string? ErrorMessage)
{
    public static DoorTriggerResult Success() => new(true, null, null);
    public static DoorTriggerResult Failure(string errorCode, string errorMessage) => new(false, errorCode, errorMessage);
}

public interface IDoorController
{
    Task<DoorTriggerResult> TriggerAsync(DoorTriggerRequest request, CancellationToken ct = default);
}
