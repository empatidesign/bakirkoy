using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Specialized;

public class AuditLog : BaseEntity
{
    public Guid? UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserRole { get; set; }
    public AuditAction Action { get; set; }
    public AuditLogLevel Level { get; set; }
    public LogResult Result { get; set; }
    public string EntityType { get; set; } = "";
    public Guid? EntityId { get; set; }
    public string? Module { get; set; }
    public string? Description { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? ChangesJson { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? SessionId { get; set; }
    public int? DurationMs { get; set; }
    public string? ErrorMessage { get; set; }
    public string? AdditionalDataJson { get; set; }

    public static AuditLog CreateDetailed(
        Guid? userId, string? userName, string? userRole,
        AuditAction action, AuditLogLevel level, LogResult result,
        string entityType, Guid? entityId, string? module,
        string? description, string? oldValues, string? newValues,
        string? changesJson, string? ipAddress, string? userAgent,
        string? sessionId, long? durationMs, string? errorMessage,
        string? additionalDataJson)
    {
        return new AuditLog
        {
            UserId = userId,
            UserName = userName,
            UserRole = userRole,
            Action = action,
            Level = level,
            Result = result,
            EntityType = entityType,
            EntityId = entityId,
            Module = module,
            Description = description,
            OldValues = oldValues,
            NewValues = newValues,
            ChangesJson = changesJson,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            SessionId = sessionId,
            DurationMs = (int?)durationMs,
            ErrorMessage = errorMessage,
            AdditionalDataJson = additionalDataJson
        };
    }
}
