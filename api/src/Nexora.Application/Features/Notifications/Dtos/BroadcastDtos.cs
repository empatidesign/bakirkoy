namespace Nexora.Application.Features.Notifications.Dtos;

public record BroadcastRequest(
    string Target,
    List<Guid> Ids,
    bool Sms,
    bool Notify,
    string Message)
{
    public string? Title { get; init; }

    public bool Push { get; init; }

    public string? Module { get; init; }

    public string? Status { get; init; }
}

public record BroadcastResultDto(int Recipients, int SmsSent, int NotificationsCreated, int PushSent = 0, bool SmsMockMode = false);

public record BroadcastTargetOptionsDto(IReadOnlyList<BroadcastTargetTypeDto> Targets);

public record BroadcastTargetTypeDto(string Value, string Label, string Description);
