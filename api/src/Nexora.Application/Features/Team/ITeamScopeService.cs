using Nexora.Application.Features.Team.Dtos;

namespace Nexora.Application.Features.Team;

public sealed class TeamProfile
{
    public required Guid UserId { get; init; }
    public required string FullName { get; init; }
    public required string RoleName { get; init; }
    public string? RoleColor { get; init; }
    public bool IsUnscoped { get; init; }
    public bool FacilityWide { get; init; }
    public required HashSet<Guid> Facilities { get; init; }
    public required HashSet<string> NodePairs { get; init; }
    public string? FacilityName { get; init; }
    public string? BranchName { get; init; }
}

public interface ITeamScopeService
{
    Task<TeamProfile?> GetProfileAsync(Guid userId, CancellationToken ct);
    bool Covers(TeamProfile caller, TeamProfile target);
    bool IsSuperior(TeamProfile caller, TeamProfile target);
    Task<bool> CanSeeAsync(Guid callerId, Guid targetId, CancellationToken ct);
    Task<bool> IsSuperiorAsync(Guid callerId, Guid targetId, CancellationToken ct);
    Task<IReadOnlyList<TeamMemberDto>> GetVisibleMembersAsync(Guid callerId, CancellationToken ct);
    Task<IReadOnlyList<TeamMemberDto>> GetSubordinatesAsync(Guid callerId, CancellationToken ct);
}
