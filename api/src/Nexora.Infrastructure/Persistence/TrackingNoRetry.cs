using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Npgsql;

namespace Nexora.Infrastructure.Persistence;

public static class TrackingNoRetry
{
    private const string TrackingNoUniqueIndex = "IX_CitizenSubmissions_TrackingNo";

    public static async Task SaveWithRetryAsync(
        IUnitOfWork uow, Action regenerateTrackingNo, CancellationToken ct, int maxAttempts = 5,
        string constraintName = TrackingNoUniqueIndex)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await uow.SaveChangesAsync(ct);
                return;
            }
            catch (DbUpdateException ex) when (attempt < maxAttempts && IsConstraintUniqueViolation(ex, constraintName))
            {
                regenerateTrackingNo();
            }
        }
    }

    private static bool IsConstraintUniqueViolation(DbUpdateException ex, string constraintName) =>
        ex.InnerException is PostgresException pg
        && pg.SqlState == PostgresErrorCodes.UniqueViolation
        && string.Equals(pg.ConstraintName, constraintName, StringComparison.Ordinal);
}
