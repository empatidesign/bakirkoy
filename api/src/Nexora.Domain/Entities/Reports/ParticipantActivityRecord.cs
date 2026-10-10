using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Reports;

public class ParticipantActivityRecord : BaseEntity
{
    public string Module { get; private set; } = string.Empty;

    public string SourceTable { get; private set; } = string.Empty;

    public Guid SourceId { get; private set; }

    public Guid? ParticipantId { get; private set; }
    public string? Tckn { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public string? ItemName { get; private set; }

    public DateTime ActivityDate { get; private set; }

    public string Status { get; private set; } = string.Empty;

    public string IdentityKey { get; private set; } = string.Empty;

    public DateTime SourceUpdatedAt { get; private set; }

    public static ParticipantActivityRecord Create(
        string module, string sourceTable, Guid sourceId,
        Guid? participantId, string? tckn, string fullName, string? phone, string? itemName,
        DateTime activityDate, string status, DateTime sourceUpdatedAt)
        => new()
        {
            Module = module,
            SourceTable = sourceTable,
            SourceId = sourceId,
            ParticipantId = participantId,
            Tckn = tckn,
            FullName = fullName,
            Phone = phone,
            ItemName = itemName,
            ActivityDate = activityDate,
            Status = status,
            IdentityKey = ComputeIdentityKey(tckn, participantId, sourceId),
            SourceUpdatedAt = sourceUpdatedAt,
        };

    public void Refresh(
        Guid? participantId, string? tckn, string fullName, string? phone, string? itemName,
        DateTime activityDate, string status, DateTime sourceUpdatedAt)
    {
        ParticipantId = participantId;
        Tckn = tckn;
        FullName = fullName;
        Phone = phone;
        ItemName = itemName;
        ActivityDate = activityDate;
        Status = status;
        IdentityKey = ComputeIdentityKey(tckn, participantId, SourceId);
        SourceUpdatedAt = sourceUpdatedAt;
        UpdatedAt = DateTime.UtcNow;
    }

    public static string ComputeIdentityKey(string? tckn, Guid? participantId, Guid sourceId)
        => !string.IsNullOrWhiteSpace(tckn) ? $"t:{tckn}"
            : participantId.HasValue ? $"p:{participantId.Value}"
            : $"s:{sourceId}";
}
