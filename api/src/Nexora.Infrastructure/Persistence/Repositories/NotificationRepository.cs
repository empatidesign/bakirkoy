using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Notifications;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class NotificationRepository(AppDbContext context)
    : Repository<Notification>(context), INotificationRepository
{
    public async Task<PagedResult<Notification>> GetPagedByRecipientsAsync(List<Guid> recipientIds, int page, int limit, CancellationToken ct)
    {
        if (recipientIds.Count == 0)
            return new PagedResult<Notification> { Items = [], Total = 0, Page = page, Limit = limit };

        var query = DbSet
            .Where(n => recipientIds.Contains(n.RecipientId))
            .OrderByDescending(n => n.CreatedAt);

        return await PaginateAsync(query, page, limit, ct);
    }

    public async Task<PagedResult<Notification>> GetTeamPagedByRecipientAsync(Guid recipientId, int page, int limit, CancellationToken ct)
    {
        var query = DbSet
            .Where(n => n.RecipientId == recipientId)
            .Where(NotificationTypes.TeamVisiblePredicate)
            .OrderByDescending(n => n.CreatedAt);

        return await PaginateAsync(query, page, limit, ct);
    }

    public async Task<int> GetUnreadCountByRecipientsAsync(List<Guid> recipientIds, CancellationToken ct)
    {
        if (recipientIds.Count == 0) return 0;

        return await DbSet.CountAsync(n => recipientIds.Contains(n.RecipientId) && !n.IsRead, ct);
    }

    public async Task<int> GetTeamUnreadCountByRecipientAsync(Guid recipientId, CancellationToken ct)
        => await DbSet
            .Where(n => n.RecipientId == recipientId && !n.IsRead)
            .Where(NotificationTypes.TeamVisiblePredicate)
            .CountAsync(ct);

    public async Task<Notification?> GetByIdForRecipientsAsync(Guid id, List<Guid> recipientIds, CancellationToken ct)
    {
        if (recipientIds.Count == 0) return null;

        return await DbSet.FirstOrDefaultAsync(n => n.Id == id && recipientIds.Contains(n.RecipientId), ct);
    }

    public async Task<List<Notification>> GetUnreadByRecipientsAsync(List<Guid> recipientIds, CancellationToken ct)
    {
        if (recipientIds.Count == 0) return [];

        return await DbSet
            .Where(n => recipientIds.Contains(n.RecipientId) && !n.IsRead)
            .ToListAsync(ct);
    }

    public async Task<PagedResult<Notification>> GetPagedByRecipientAsync(Guid recipientId, int page, int limit, CancellationToken ct)
    {
        var query = DbSet
            .Where(n => n.RecipientId == recipientId)
            .OrderByDescending(n => n.CreatedAt);

        return await PaginateAsync(query, page, limit, ct);
    }
}
