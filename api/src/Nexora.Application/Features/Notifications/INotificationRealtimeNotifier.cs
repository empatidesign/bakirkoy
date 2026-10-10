namespace Nexora.Application.Features.Notifications;

public record AdminNotificationPayload(
    Guid Id,
    string Title,
    string Body,
    string ReferenceType,
    string? ReferenceId,
    DateTime CreatedAt);

public record CitizenNotificationPayload(
    Guid Id,
    string Title,
    string Body,
    string Type,
    string? ReferenceType,
    string? ReferenceId,
    DateTime CreatedAt);

public interface INotificationRealtimeNotifier
{
    Task NotifyAdminAsync(Guid adminId, AdminNotificationPayload payload, CancellationToken ct = default);
    Task NotifyCitizenAsync(Guid participantId, CitizenNotificationPayload payload, CancellationToken ct = default);
}
