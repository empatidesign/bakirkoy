using Nexora.Domain.Entities.Team;

namespace Nexora.Application.Common.Repositories;

public interface ITeamNoteRepository : IRepository<TeamNote>
{
    Task<List<TeamNote>> GetForUserAsync(Guid userId, CancellationToken ct);
}

public interface ITeamTaskRepository : IRepository<TeamTask>
{
    Task<List<TeamTask>> GetForUserAsync(Guid userId, CancellationToken ct);
}

public interface ITeamMessageRepository : IRepository<TeamMessage>
{
    Task<List<TeamMessage>> GetThreadAsync(Guid userA, Guid userB, CancellationToken ct);
    Task<List<UnreadSenderCount>> GetUnreadCountsBySenderAsync(Guid recipientId, CancellationToken ct);
    Task<List<Guid>> GetConversationPartnerIdsAsync(Guid userId, CancellationToken ct);
    Task<bool> HasThreadAsync(Guid userA, Guid userB, CancellationToken ct);
}

public record UnreadSenderCount(Guid SenderId, int Count);
