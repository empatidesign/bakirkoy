namespace Nexora.Application.Features.DutyPharmacies;

public interface IDutyPharmacySyncClient
{
    Task<IReadOnlyList<DutyPharmacySyncItem>> FetchSultangaziAsync(CancellationToken ct);
}

public record DutyPharmacySyncItem(
    long Sicil,
    string Name,
    string? Phone,
    string? Directions,
    string? Address,
    string? Neighborhood,
    double? Latitude,
    double? Longitude,
    string? DutyEndTime);
