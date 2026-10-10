using Nexora.Application.Features.DutyPharmacies.Dtos;

namespace Nexora.Application.Features.DutyPharmacies;

public interface IDutyPharmacyService
{
    Task<List<CitizenDutyPharmacyDto>> GetActiveAsync(CancellationToken ct);
    Task<DutyPharmacySyncStatusDto> GetSyncStatusAsync(CancellationToken ct);
}
