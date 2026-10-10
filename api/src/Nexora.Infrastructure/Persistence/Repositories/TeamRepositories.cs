using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.Repositories;
using Nexora.Domain.Entities.Team;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class TeamNoteRepository(AppDbContext context) : Repository<TeamNote>(context), ITeamNoteRepository
{
    public async Task<List<TeamNote>> GetForUserAsync(Guid userId, CancellationToken ct)
        => await DbSet
            .Where(n => n.AuthorId == userId || n.TargetUserId == userId)
            .OrderByDescending(n => n.Pinned)
            .ThenByDescending(n => n.CreatedAt)
            .ToListAsync(ct);
}

public class TeamTaskRepository(AppDbContext context) : Repository<TeamTask>(context), ITeamTaskRepository
{
    public async Task<List<TeamTask>> GetForUserAsync(Guid userId, CancellationToken ct)
        => await DbSet
            .Where(t => t.AssignerId == userId || t.AssigneeId == userId)
            .OrderBy(t => t.Status == "done")
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync(ct);
}

public class TeamMessageRepository(AppDbContext context) : Repository<TeamMessage>(context), ITeamMessageRepository
{
    public async Task<List<TeamMessage>> GetThreadAsync(Guid userA, Guid userB, CancellationToken ct)
        => await DbSet
            .Where(m => (m.SenderId == userA && m.RecipientId == userB) || (m.SenderId == userB && m.RecipientId == userA))
            .OrderBy(m => m.CreatedAt)
            .ToListAsync(ct);

    public async Task<List<UnreadSenderCount>> GetUnreadCountsBySenderAsync(Guid recipientId, CancellationToken ct)
        => await DbSet
            .Where(m => m.RecipientId == recipientId && m.ReadAt == null)
            .GroupBy(m => m.SenderId)
            .Select(g => new UnreadSenderCount(g.Key, g.Count()))
            .ToListAsync(ct);

    public async Task<List<Guid>> GetConversationPartnerIdsAsync(Guid userId, CancellationToken ct)
    {
        var sent = await DbSet.Where(m => m.SenderId == userId).Select(m => m.RecipientId).Distinct().ToListAsync(ct);
        var received = await DbSet.Where(m => m.RecipientId == userId).Select(m => m.SenderId).Distinct().ToListAsync(ct);
        return sent.Concat(received).Where(id => id != userId).Distinct().ToList();
    }

    public async Task<bool> HasThreadAsync(Guid userA, Guid userB, CancellationToken ct)
        => await DbSet.AnyAsync(
            m => (m.SenderId == userA && m.RecipientId == userB) || (m.SenderId == userB && m.RecipientId == userA), ct);
}
