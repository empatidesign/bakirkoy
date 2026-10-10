namespace Nexora.Application.Features.AuditLogs.Dtos;

public record AuditLogListItemDto(
    Guid Id,
    DateTime CreatedAt,
    Guid? UserId,
    string? UserName,
    string? UserRole,
    string Action,
    string Level,
    string Result,
    string EntityType,
    Guid? EntityId,
    string? Module,
    string? Description,
    string? IpAddress
);

public record AuditLogDetailDto(
    Guid Id,
    DateTime CreatedAt,
    Guid? UserId,
    string? UserName,
    string? UserRole,
    string Action,
    string Level,
    string Result,
    string EntityType,
    Guid? EntityId,
    string? Module,
    string? Description,
    string? OldValues,
    string? NewValues,
    string? ChangesJson,
    string? IpAddress,
    string? UserAgent,
    string? SessionId,
    int? DurationMs,
    string? ErrorMessage,
    string? AdditionalDataJson
);

public record AuditLogFilterOptionsDto(List<string> Modules, List<string> Actions, List<string> EntityTypes);

public record AuditLogListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Action { get; init; }
    public string? Module { get; init; }
    public string? EntityType { get; init; }
    public string? Result { get; init; }
    public DateTime? DateFrom { get; init; }
    public DateTime? DateTo { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}
