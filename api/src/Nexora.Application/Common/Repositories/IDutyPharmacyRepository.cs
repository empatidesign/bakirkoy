using Nexora.Domain.Entities.DutyPharmacies;

namespace Nexora.Application.Common.Repositories;

public interface IDutyPharmacyRepository : IRepository<DutyPharmacy>
{
    Task<List<DutyPharmacy>> GetActiveAsync(CancellationToken ct);
    Task<DutyPharmacy?> GetBySicilAsync(long sicil, CancellationToken ct);
    Task<(DateTime? LastSyncedAt, DateOnly? LastDutyDate, int LatestCount)> GetSyncStatusAsync(CancellationToken ct);
}
