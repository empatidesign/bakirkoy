namespace Nexora.Application.Features.DutyPharmacies.Dtos;

public record DutyPharmacySyncStatusDto(
    DateTime? LastSyncedAt,
    DateOnly? LastDutyDate,
    int LatestCount,
    bool IsStale);
