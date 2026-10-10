using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications.Dtos;

namespace Nexora.Application.Features.Notifications;

public interface INotificationService
{
    Task CreateAsync(Guid recipientId, string title, string body, string type, CancellationToken ct);
    Task CreateAsync(Guid recipientId, string title, string body, string type,
        string? referenceType, string? referenceId,
        string? facilityName, string? sessionInfo, string? statusInfo, CancellationToken ct);
    Task<PagedResult<CitizenNotificationDto>> GetForRecipientAsync(Guid participantId, string? scope, int page, int limit, CancellationToken ct);
    Task<int> GetUnreadCountAsync(Guid participantId, string? scope, CancellationToken ct);
    Task MarkReadAsync(Guid participantId, Guid notificationId, CancellationToken ct);
    Task MarkAllReadAsync(Guid participantId, string? scope, CancellationToken ct);

    // Kullanıcı isteği (2026-09-01): zorunlu onaylı duyuru. Anketör "Okudum"
    // demeden popup kapanmaz; bekleyenler her açılışta tekrar gösterilir.
    Task CreateAsync(Guid recipientId, string title, string body, string type,
        string? referenceType, string? referenceId, bool requiresAck, CancellationToken ct);
    Task<List<CitizenNotificationDto>> GetPendingAcknowledgementsAsync(Guid participantId, CancellationToken ct);
    Task AcknowledgeAsync(Guid participantId, Guid notificationId, CancellationToken ct);
}
