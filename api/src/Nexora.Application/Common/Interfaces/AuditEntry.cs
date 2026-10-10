using Nexora.Domain.Enums;

namespace Nexora.Application.Common.Interfaces;

public sealed record AuditEntry
{
    public required AuditAction Action { get; init; }
    public required string EntityType { get; init; }
    public Guid? EntityId { get; init; }
    public string? Module { get; init; }
    public string? Description { get; init; }
    public LogResult Result { get; init; } = LogResult.Success;
    public AuditLogLevel Level { get; init; } = AuditLogLevel.Info;
    public string? OldValues { get; init; }
    public string? NewValues { get; init; }
    public string? ChangesJson { get; init; }
    public long? DurationMs { get; init; }
    public string? ErrorMessage { get; init; }
    public string? AdditionalDataJson { get; init; }
    public Guid? ActorUserId { get; init; }
    public string? ActorUserName { get; init; }
    public string? ActorUserRole { get; init; }
}
