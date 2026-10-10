using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.NotificationPreferences;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Services;

public class NotificationService(
    IUnitOfWork uow,
    INotificationRealtimeNotifier realtime,
    INotificationPreferenceService preferences,
    IPushSender push) : INotificationService
{
    public Task CreateAsync(Guid recipientId, string title, string body, string type, CancellationToken ct)
        => CreateAsync(recipientId, title, body, type, null, null, null, null, null, ct);

    public async Task CreateAsync(Guid recipientId, string title, string body, string type,
        string? referenceType, string? referenceId,
        string? facilityName, string? sessionInfo, string? statusInfo, CancellationToken ct)
        => await CreateInternalAsync(recipientId, title, body, type, referenceType, referenceId,
            facilityName, sessionInfo, statusInfo, false, ct);

    // Kullanıcı isteği (2026-09-01): zorunlu onaylı duyuru.
    public Task CreateAsync(Guid recipientId, string title, string body, string type,
        string? referenceType, string? referenceId, bool requiresAck, CancellationToken ct)
        => CreateInternalAsync(recipientId, title, body, type, referenceType, referenceId,
            null, null, null, requiresAck, ct);

    private async Task CreateInternalAsync(Guid recipientId, string title, string body, string type,
        string? referenceType, string? referenceId,
        string? facilityName, string? sessionInfo, string? statusInfo, bool requiresAck, CancellationToken ct)
    {
        var category = NotificationCategoryMap.Resolve(type);
        var delivery = await preferences.GetDeliveryAsync(recipientId, category, ct);

        // Zorunlu onaylı duyuru, kişisel bildirim tercihiyle bastırılamaz: saha
        // görevlisine ulaşması gereken operasyonel bir talimattır.
        if (!delivery.InAppEnabled && !requiresAck)
            return;

        var notification = Notification.Create(recipientId, title, body, type,
            referenceType, referenceId, facilityName, sessionInfo, statusInfo, requiresAck);
        await uow.Notifications.AddAsync(notification, ct);
        await uow.SaveChangesAsync(ct);

        if ((!delivery.PushEnabled || delivery.IsQuietNow) && !requiresAck)
            return;

        await realtime.NotifyCitizenAsync(recipientId, new CitizenNotificationPayload(
            notification.Id, notification.Title, notification.Body, notification.Type,
            notification.ReferenceType, notification.ReferenceId, notification.CreatedAt), ct);

        // SignalR yalnızca uygulama açıkken ulaşır; arka planda/kapalıyken
        // bildirimi FCM taşır. Mobil tarafta ikisi de aynı kaydı gösterir.
        await push.SendToParticipantAsync(recipientId, notification.Title, notification.Body,
            new Dictionary<string, string>
            {
                ["notificationId"] = notification.Id.ToString(),
                ["type"] = notification.Type ?? string.Empty,
                ["referenceType"] = notification.ReferenceType ?? string.Empty,
                ["referenceId"] = notification.ReferenceId ?? string.Empty,
            }, ct);
    }

    public async Task<PagedResult<CitizenNotificationDto>> GetForRecipientAsync(Guid participantId, string? scope, int page, int limit, CancellationToken ct)
    {
        var safePage = page < 1 ? 1 : page;
        var safeLimit = limit < 1 ? 25 : limit;

        var recipientIds = await ResolveScopeIdsAsync(participantId, scope, ct);

        var paged = await uow.Notifications.GetPagedByRecipientsAsync(recipientIds, safePage, safeLimit, ct);
        var items = await MapManyAsync(paged.Items, participantId, ct);

        return new PagedResult<CitizenNotificationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<int> GetUnreadCountAsync(Guid participantId, string? scope, CancellationToken ct)
    {
        var recipientIds = await ResolveScopeIdsAsync(participantId, scope, ct);
        return await uow.Notifications.GetUnreadCountByRecipientsAsync(recipientIds, ct);
    }

    public async Task MarkReadAsync(Guid participantId, Guid notificationId, CancellationToken ct)
    {
        var allowedIds = await ResolveScopeIdsAsync(participantId, "family", ct);

        var notification = await uow.Notifications.GetByIdForRecipientsAsync(notificationId, allowedIds, ct)
            ?? throw new ForbiddenException("Bu bildirime erişim yetkiniz yok.", "NOTIFICATION_FORBIDDEN");

        notification.MarkRead();
        uow.Notifications.Update(notification);
        await uow.SaveChangesAsync(ct);
    }

    public async Task MarkAllReadAsync(Guid participantId, string? scope, CancellationToken ct)
    {
        var recipientIds = await ResolveScopeIdsAsync(participantId, scope, ct);

        var unread = await uow.Notifications.GetUnreadByRecipientsAsync(recipientIds, ct);
        if (unread.Count == 0) return;

        // Onay bekleyen duyuru "tümünü okundu yap" ile kapatılamaz: kullanıcı
        // metni görmeden onaylamış sayılmamalı.
        var closable = unread.Where(n => !n.RequiresAck || n.IsAcknowledged).ToList();
        if (closable.Count == 0) return;

        foreach (var notification in closable)
            notification.MarkRead();

        uow.Notifications.UpdateRange(closable);
        await uow.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Onay bekleyen duyurular: uygulama açılışında kapatılamaz popup olarak gösterilir.
    /// Yalnızca kişinin kendisine ait olanlar döner (çocuk hesapları dahil edilmez);
    /// zorunlu talimat, onu görecek kişiye özeldir.
    /// </summary>
    public async Task<List<CitizenNotificationDto>> GetPendingAcknowledgementsAsync(Guid participantId, CancellationToken ct)
    {
        var pending = (await uow.Notifications.FindAsync(
                n => n.RecipientId == participantId && n.RequiresAck && n.AcknowledgedAt == null, ct))
            .OrderBy(n => n.CreatedAt)
            .ToList();

        return await MapManyAsync(pending, participantId, ct);
    }

    public async Task AcknowledgeAsync(Guid participantId, Guid notificationId, CancellationToken ct)
    {
        var notification = await uow.Notifications.GetByIdForRecipientsAsync(notificationId, [participantId], ct)
            ?? throw new ForbiddenException("Bu bildirime erişim yetkiniz yok.", "NOTIFICATION_FORBIDDEN");

        notification.Acknowledge();
        uow.Notifications.Update(notification);
        await uow.SaveChangesAsync(ct);
    }

    private async Task<List<Guid>> ResolveScopeIdsAsync(Guid participantId, string? scope, CancellationToken ct)
    {
        var ids = new List<Guid> { participantId };

        if (!string.Equals(scope, "self", StringComparison.OrdinalIgnoreCase))
        {
            var children = await uow.Participants.GetChildrenAsync(participantId, ct);
            ids.AddRange(children.Select(c => c.Id));
        }

        return ids.Distinct().ToList();
    }

    private async Task<List<CitizenNotificationDto>> MapManyAsync(List<Notification> notifications, Guid currentParticipantId, CancellationToken ct)
    {
        if (notifications.Count == 0) return [];

        var recipientIds = notifications.Select(n => n.RecipientId).Distinct().ToList();
        var people = (await uow.Participants.FindAsync(p => recipientIds.Contains(p.Id), ct))
            .ToDictionary(p => p.Id, p => p.FullName);

        return notifications.Select(n => new CitizenNotificationDto(
            n.Id,
            n.Title,
            n.Body,
            n.Type,
            n.IsRead,
            n.CreatedAt,
            n.RecipientId,
            people.GetValueOrDefault(n.RecipientId, ""),
            n.RecipientId == currentParticipantId,
            n.ReferenceType,
            n.ReferenceId,
            n.FacilityName,
            n.SessionInfo,
            n.StatusInfo,
            n.RequiresAck,
            n.AcknowledgedAt)).ToList();
    }
}
