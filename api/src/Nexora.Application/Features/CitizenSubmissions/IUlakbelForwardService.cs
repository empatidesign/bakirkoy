namespace Nexora.Application.Features.CitizenSubmissions;

public interface IUlakbelForwardService
{
    Task<UlakbelForwardResult> ForwardAsync(UlakbelForwardRequest request, CancellationToken ct);
}

public record UlakbelForwardRequest(
    Guid SubmissionId,
    string? TrackingNo,
    string CitizenPhone,
    string Title,
    string Description,
    string Neighborhood,
    string Address,
    double? Latitude,
    double? Longitude,
    string CategoryLabel,
    string Priority,
    string TargetUnit,
    IReadOnlyList<string> MediaUrls);

public enum UlakbelForwardOutcome
{
    Delivered,
    Failed,
    Unknown
}

public record UlakbelForwardResult(
    bool IsSimulated,
    string TrackingNo,
    bool Success,
    string? ErrorMessage,
    UlakbelForwardOutcome Outcome = UlakbelForwardOutcome.Failed);
