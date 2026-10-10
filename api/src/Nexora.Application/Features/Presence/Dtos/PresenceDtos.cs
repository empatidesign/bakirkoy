namespace Nexora.Application.Features.Presence.Dtos;

public record OnlinePersonDto(
    Guid Id,
    string FullName,
    string RoleName,
    string? RoleColor,
    string? FacilityName,
    string? BranchName,
    string Device,
    int LastSeenSeconds,
    bool Online);

public record PresenceHeartbeatRequest(string? Device);

public record PresenceBroadcastRequest(string Target, string Message, bool AlsoSms = false);

public record PresenceBroadcastResult(int RecipientCount);
