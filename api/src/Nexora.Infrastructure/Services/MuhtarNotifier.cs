using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-08): "sistem içinde bunların kendi bildirimleri olsun" — vatandaş
/// bir başvuru oluştururken "Muhtara bildirim gönder" seçeneğini işaretlerse, o mahallenin
/// atanmış muhtarına (varsa) in-app bildirim + realtime bildirim gönderilir. Mahalleye henüz
/// muhtar atanmamışsa (FindMuhtarAdminAsync null döner) sessizce atlanır — CitizenSubmissionService
/// zaten bu durumda MuhtarlikReference.MuhtarFor fallback'ini (statik iletişim bilgisi)
/// kullanıyor, o kişinin gerçek bir AdminUser hesabı olmadığı için in-app bildirim gönderilemez.
/// GiftRequestNotifier / LibraryNotificationService.NotifyStaffOverdueAsync ile aynı pattern.
/// </summary>
public interface IMuhtarNotifier
{
    Task NotifyNewSubmissionAsync(CitizenSubmission submission, CancellationToken ct);
}

public class MuhtarNotifier(IUnitOfWork uow, INotificationRealtimeNotifier realtime) : IMuhtarNotifier
{
    private const string ReferenceType = Nexora.Domain.Entities.Notifications.NotificationTypes.MuhtarlikSubmission;

    public async Task NotifyNewSubmissionAsync(CitizenSubmission submission, CancellationToken ct)
    {
        var refId = MuhtarlikReference.NeighborhoodRefId(submission.Neighborhood);
        var node = await uow.ScopeNodes.GetByRefAsync("muhtarlik", refId, ct);
        if (node is null) return;

        var scopes = await uow.AdminScopes.GetByScopeNodeAsync(node.Id, ct);
        if (scopes.Count == 0) return;

        // Denetim düzeltmesi (2026-09-07, canlı DB'de kanıtlandı — bkz. CitizenSubmissionService.
        // FindMuhtarAdminAsync'teki aynı bulgu): silinen bir yöneticinin AdminScope kalıntısı
        // temizlenmemişse (2026-09-05 öncesi oluşmuş kayıtlar için mümkün), buradaki kod
        // yalnızca "kaç scope var" diye sayıyor ama HANGİ AdminUser'ların GERÇEKTEN var olduğunu
        // kontrol etmiyordu — silinmiş/yok bir kullanıcıya "bildirim" oluşturulup (RecipientId'de
        // FK olmadığı için sessizce başarılı görünen ama asla görülemeyecek), mahalledeki
        // GERÇEK aktif muhtara hiç bildirim gitmeyebiliyordu. Artık yalnızca gerçekten var olan
        // (soft-delete filtresini geçen) AdminUser'lara bildirim oluşturulur.
        var liveRecipientIds = new List<Guid>();
        foreach (var s in scopes)
        {
            if (await uow.AdminUsers.GetByIdAsync(s.AdminUserId, ct) is not null)
                liveRecipientIds.Add(s.AdminUserId);
        }
        if (liveRecipientIds.Count == 0) return;

        var title = submission.SubmissionType switch
        {
            "complaint" => "Yeni Şikayet Bildirimi",
            "suggestion" => "Yeni Öneri Bildirimi",
            _ => "Yeni Talep Bildirimi",
        };
        var categoryLabel = MuhtarlikReference.CategoryLabel(submission.CategoryId);
        var body = $"{submission.Neighborhood} — \"{submission.Title}\" ({categoryLabel})";

        var notifications = liveRecipientIds
            .Select(recipientId => Notification.Create(
                recipientId, title, body, ReferenceType,
                ReferenceType, submission.Id.ToString(),
                null, submission.Neighborhood, submission.Priority))
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
