using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.DutyPharmacies;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class DutyPharmacyRepository(AppDbContext context)
    : Repository<DutyPharmacy>(context), IDutyPharmacyRepository
{
    public async Task<List<DutyPharmacy>> GetActiveAsync(CancellationToken ct)
    {
        var maxDate = await DbSet.MaxAsync(x => (DateOnly?)x.DutyDate, ct);
        if (maxDate is null) return [];
        return await DbSet
            .Where(x => x.DutyDate == maxDate)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
    }

    public async Task<DutyPharmacy?> GetBySicilAsync(long sicil, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.Sicil == sicil, ct);

    public async Task<(DateTime? LastSyncedAt, DateOnly? LastDutyDate, int LatestCount)> GetSyncStatusAsync(CancellationToken ct)
    {
        var maxDate = await DbSet.MaxAsync(x => (DateOnly?)x.DutyDate, ct);
        var lastSyncedAt = await DbSet.MaxAsync(x => (DateTime?)x.SyncedAt, ct);
        var latestCount = maxDate is null ? 0 : await DbSet.CountAsync(x => x.DutyDate == maxDate, ct);
        return (lastSyncedAt, maxDate, latestCount);
    }
}
