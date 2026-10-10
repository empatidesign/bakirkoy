using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Wheels;
using Nexora.Domain.Entities.Notifications;
using Nexora.Domain.Entities.Wheels;

namespace Nexora.Infrastructure.Services;

public class GiftRequestNotifier(IUnitOfWork uow, INotificationRealtimeNotifier realtime) : IGiftRequestNotifier
{
    private const string ReferenceType = "gift-request";

    public async Task NotifyNewRequestAsync(GiftRequest request, CancellationToken ct)
    {
        var adminIds = await uow.AdminUsers.GetIdsByPermissionAsync("wheel.view", ct);
        if (adminIds.Count == 0) return;

        var source = request.Source == "wheel" ? "çark" : "puanla başvuru";
        var title = "Yeni hediye talebi";
        var body = $"{request.CitizenName} — {request.GiftName} ({source})";

        var notifications = adminIds
            .Select(adminId => Notification.Create(adminId, title, body, ReferenceType, ReferenceType, request.Id.ToString()))
            .ToList();

        await uow.Notifications.AddRangeAsync(notifications, ct);
        await uow.SaveChangesAsync(ct);

        foreach (var n in notifications)
            await realtime.NotifyAdminAsync(
                n.RecipientId,
                new AdminNotificationPayload(n.Id, n.Title, n.Body, ReferenceType, n.ReferenceId, n.CreatedAt),
                ct);
    }
}
