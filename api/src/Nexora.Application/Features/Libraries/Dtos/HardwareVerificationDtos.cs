namespace Nexora.Application.Features.Libraries.Dtos;

public record PlannedDeviceInput(string Direction, string OperationMode, bool TriggerLockOnSuccess);

public record HardwareVerificationRequest(
    string RequestedTemplateId,
    string? SeatingMode,
    bool QueueEnabled,
    bool ReservationEnabled,
    bool BreakSystemEnabled,
    string? AccessType,
    List<PlannedDeviceInput>? PlannedDevices);

public record HardwareVerificationResultDto(
    string RequestedTemplateId,
    bool IsSatisfied,
    List<string> MissingRequirements,
    string? FallbackTemplateId);
