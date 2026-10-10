using Nexora.Application.Common.Repositories;
using Nexora.Domain.Common;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Team;
using Nexora.Application.Features.Team.Dtos;
using Nexora.Domain.Entities.Authority;

namespace Nexora.Infrastructure.Services;

public class TeamScopeService(IUnitOfWork uow) : ITeamScopeService
{
    private const string ServiceFacilitiesKey = "service-facilities";

    private static bool IsFacilityScopeKey(string moduleKey)
        => moduleKey == ServiceFacilitiesKey || FacilityModuleRegistry.IsValid(moduleKey);

    public bool Covers(TeamProfile caller, TeamProfile target)
    {
        if (caller.IsUnscoped) return true;
        if (target.IsUnscoped) return false;
        if (target.NodePairs.Count > 0 && target.NodePairs.IsSubsetOf(caller.NodePairs)) return true;
        if (caller.FacilityWide && target.Facilities.Count > 0 && target.Facilities.IsSubsetOf(caller.Facilities)) return true;
        return false;
    }

    public bool IsSuperior(TeamProfile caller, TeamProfile target)
    {
        if (caller.UserId == target.UserId) return false;
        return Covers(caller, target) && !Covers(target, caller);
    }

    public async Task<bool> CanSeeAsync(Guid callerId, Guid targetId, CancellationToken ct)
    {
        if (callerId == targetId) return true;
        var caller = await GetProfileAsync(callerId, ct);
        var target = await GetProfileAsync(targetId, ct);
        return caller is not null && target is not null && Covers(caller, target);
    }

    public async Task<bool> IsSuperiorAsync(Guid callerId, Guid targetId, CancellationToken ct)
    {
        var caller = await GetProfileAsync(callerId, ct);
        var target = await GetProfileAsync(targetId, ct);
        return caller is not null && target is not null && IsSuperior(caller, target);
    }

    public async Task<IReadOnlyList<TeamMemberDto>> GetVisibleMembersAsync(Guid callerId, CancellationToken ct)
        => await BuildMemberListAsync(callerId, superiorOnly: false, ct);

    public async Task<IReadOnlyList<TeamMemberDto>> GetSubordinatesAsync(Guid callerId, CancellationToken ct)
        => await BuildMemberListAsync(callerId, superiorOnly: true, ct);

    private async Task<IReadOnlyList<TeamMemberDto>> BuildMemberListAsync(Guid callerId, bool superiorOnly, CancellationToken ct)
    {
        var caller = await GetProfileAsync(callerId, ct);
        if (caller is null) return [];

        var admins = await uow.AdminUsers.FindAsync(a => a.IsActive && a.Id != callerId, ct);
        var result = new List<TeamMemberDto>();
        foreach (var admin in admins)
        {
            var profile = await GetProfileAsync(admin.Id, ct);
            if (profile is null) continue;
            var include = superiorOnly ? IsSuperior(caller, profile) : Covers(caller, profile);
            if (!include) continue;
            result.Add(new TeamMemberDto(profile.UserId, profile.FullName, profile.RoleName, profile.RoleColor, profile.FacilityName, profile.BranchName));
        }
        return result.OrderBy(m => m.FullName).ToList();
    }

    public async Task<TeamProfile?> GetProfileAsync(Guid userId, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct);
        if (user is null) return null;

        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        var roleName = role?.Name ?? "";
        var roleColor = role?.Color;

        var superAdmin = await IsSuperAdminAsync(role, ct);
        var scopes = await uow.AdminScopes.GetByAdminUserAsync(userId, ct);

        if (superAdmin)
            return new TeamProfile
            {
                UserId = userId, FullName = user.FullName, RoleName = roleName, RoleColor = roleColor,
                IsUnscoped = true, FacilityWide = false, Facilities = [], NodePairs = [], FacilityName = null, BranchName = null,
            };

        var nodes = scopes.Count == 0
            ? []
            : await uow.ScopeNodes.GetByIdsAsync(scopes.Select(s => s.ScopeNodeId).Distinct().ToList(), ct);
        var active = new List<ScopeNode>();
        foreach (var node in nodes.Where(n => n.IsActive))
        {
            if (!await IsScopeExpiredAsync(node, ct)) active.Add(node);
        }

        var nodePairs = active.Select(n => $"{n.RefModuleKey}:{n.RefId}").ToHashSet();
        var facilityNodes = active.Where(n => IsFacilityScopeKey(n.RefModuleKey)).ToList();
        var facilityRefIds = facilityNodes.Select(n => n.RefId).Distinct().ToList();
        var groupRefIds = active.Where(n => n.RefModuleKey == "groups").Select(n => n.RefId).Distinct().ToList();

        var facilities = facilityRefIds.ToHashSet();
        if (groupRefIds.Count > 0)
            facilities.UnionWith(await uow.FacilityGroups.GetFacilityIdsByGroupIdsAsync(groupRefIds, ct));

        var facilityName = facilityNodes.FirstOrDefault()?.Name ?? active.FirstOrDefault()?.Name;
        var branchName = active.FirstOrDefault(n => !IsFacilityScopeKey(n.RefModuleKey))?.Name;

        return new TeamProfile
        {
            UserId = userId, FullName = user.FullName, RoleName = roleName, RoleColor = roleColor,
            IsUnscoped = false, FacilityWide = facilityRefIds.Count > 0, Facilities = facilities, NodePairs = nodePairs,
            FacilityName = facilityName, BranchName = branchName,
        };
    }

    private async Task<bool> IsScopeExpiredAsync(ScopeNode node, CancellationToken ct)
    {
        switch (node.RefModuleKey)
        {
            case "travels":
            {
                var travel = await uow.Travels.GetByIdAsync(node.RefId, ct);
                return travel is null || travel.EndDate < DateTime.UtcNow; // UAT 2026-09-24: alan UTC saklanır; duvar saati (UTC+3) ile kıyas pencereyi 3 saat kaydırıyordu
            }
            case "sessions":
            {
                var session = await uow.Sessions.GetByIdAsync(node.RefId, ct);
                // KİMLİK 2026-08-27: session.Date UTC saklanır; TurkeyTime.ToTurkey ile
                // dönüştürmeden .Date karşılaştırması gece yarısı-03:00 arası bugünkü
                // seansları yanlışlıkla "geçmiş" sayardı (bkz. EventApplicationService).
                return session is null || TurkeyTime.ToTurkey(session.Date).Date < TurkeyTime.TodayDate();
            }
            case "groups":
            {
                var group = await uow.FacilityGroups.GetByIdAsync(node.RefId, ct);
                // KİMLİK 2026-08-27: PeriodEnd UTC saklanır; ToTurkey dönüşümü gerekir (bkz. üstteki not).
                return group is null || (group.PeriodEnd.HasValue && TurkeyTime.ToTurkey(group.PeriodEnd.Value).Date < TurkeyTime.TodayDate());
            }
            default:
                return false;
        }
    }

    private static Task<bool> IsSuperAdminAsync(Domain.Entities.Auth.Role? role, CancellationToken ct)
        => Task.FromResult(role?.IsSuperAdmin == true);
}
