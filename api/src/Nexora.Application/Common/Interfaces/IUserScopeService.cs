namespace Nexora.Application.Common.Interfaces;

public interface IUserScopeService
{
    Task<HashSet<Guid>?> GetScopedRefIdsAsync(Guid userId, string moduleKey, CancellationToken ct);

    Task<HashSet<Guid>?> GetInstructorGroupIdsAsync(Guid userId, string module, CancellationToken ct);

    Task<IReadOnlyList<UserScopeGroup>> GetScopeGroupsAsync(Guid userId, CancellationToken ct);

    Task<HashSet<Guid>?> GetScopedParticipantIdsAsync(Guid userId, CancellationToken ct);

    Task<HashSet<string>?> GetScopedNamesAsync(Guid userId, string moduleKey, CancellationToken ct);
}

public sealed record UserScopeGroup(string ModuleKey, IReadOnlyList<Guid> RefIds);
