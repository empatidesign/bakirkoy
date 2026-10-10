using Nexora.Application.Common.ApiResponse;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Application.Common.Repositories;

public interface INotificationRepository : IRepository<Notification>
{
    Task<PagedResult<Notification>> GetPagedByRecipientsAsync(List<Guid> recipientIds, int page, int limit, CancellationToken ct);
    Task<PagedResult<Notification>> GetTeamPagedByRecipientAsync(Guid recipientId, int page, int limit, CancellationToken ct);
    Task<int> GetUnreadCountByRecipientsAsync(List<Guid> recipientIds, CancellationToken ct);
    Task<int> GetTeamUnreadCountByRecipientAsync(Guid recipientId, CancellationToken ct);
    Task<Notification?> GetByIdForRecipientsAsync(Guid id, List<Guid> recipientIds, CancellationToken ct);
    Task<List<Notification>> GetUnreadByRecipientsAsync(List<Guid> recipientIds, CancellationToken ct);

    // Admin panelde katılımcı detayındaki "Bildirimler" sekmesi için: bu kişiye (SMS/push/in-app)
    // gönderilmiş tüm bildirimleri en yeniden eskiye sayfalayarak döner.
    Task<PagedResult<Notification>> GetPagedByRecipientAsync(Guid recipientId, int page, int limit, CancellationToken ct);
}
