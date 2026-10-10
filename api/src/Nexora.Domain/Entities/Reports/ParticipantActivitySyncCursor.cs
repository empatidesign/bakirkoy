using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Reports;

public class ParticipantActivitySyncCursor : BaseEntity
{
    public string Module { get; private set; } = string.Empty;
    public DateTime LastSyncedUpTo { get; private set; }
    public DateTime? LastRunAt { get; private set; }
    public int LastRunUpserts { get; private set; }

    public static ParticipantActivitySyncCursor Create(string module, DateTime lastSyncedUpTo)
        => new() { Module = module, LastSyncedUpTo = lastSyncedUpTo, LastRunAt = DateTime.UtcNow };

    public void Advance(DateTime lastSyncedUpTo, int upserts)
    {
        LastSyncedUpTo = lastSyncedUpTo;
        LastRunAt = DateTime.UtcNow;
        LastRunUpserts = upserts;
        UpdatedAt = DateTime.UtcNow;
    }
}
