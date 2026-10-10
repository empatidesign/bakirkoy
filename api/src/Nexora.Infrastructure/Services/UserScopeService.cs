using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Domain.Entities.Authority;
using Nexora.Domain.Entities.Facilities;

namespace Nexora.Infrastructure.Services;

public class UserScopeService(IUnitOfWork uow) : IUserScopeService
{
    private const string InstructorRoleKey = "tpl-egitmen";

    public async Task<HashSet<Guid>?> GetScopedRefIdsAsync(Guid userId, string moduleKey, CancellationToken ct)
    {
        var role = await LoadRoleAsync(userId, ct);
        if (IsUnscoped(role)) return null;

        var nodes = await LoadScopeNodesAsync(userId, ct);

        if (IsInstructor(role))
        {
            var scoped = nodes.Where(n => n.IsActive && n.RefModuleKey == moduleKey).Select(n => n.RefId).ToHashSet();
            scoped.UnionWith(await DeriveInstructorRefIdsAsync(userId, moduleKey, nodes, ct));
            return scoped;
        }

        if (nodes.Count == 0) return [];

        var direct = nodes
            .Where(n => n.IsActive && n.RefModuleKey == moduleKey)
            .Select(n => n.RefId)
            .ToHashSet();

        if (direct.Count > 0) return direct;

        var facilityIds = nodes
            .Where(n => n.IsActive && n.RefModuleKey == "service-facilities")
            .Select(n => n.RefId)
            .Distinct()
            .ToList();

        if (facilityIds.Count == 0)
        {
            var groupIds = nodes
                .Where(n => n.IsActive && n.RefModuleKey == "groups")
                .Select(n => n.RefId)
                .Distinct()
                .ToList();

            if (groupIds.Count > 0)
            {
                var facilityIdsFromGroups = await uow.FacilityGroups.GetFacilityIdsByGroupIdsAsync(groupIds, ct);
                if (facilityIdsFromGroups.Count > 0)
                    return [.. facilityIdsFromGroups];
            }

            return [];
        }

        if (moduleKey == "halls")
            return (await uow.Halls.GetIdsByFacilityIdsAsync(facilityIds, ct)).ToHashSet();

        if (moduleKey == "events")
            return (await uow.Events.GetIdsByFacilityIdsAsync(facilityIds, ct)).ToHashSet();

        return [];
    }

    public async Task<HashSet<Guid>?> GetInstructorGroupIdsAsync(Guid userId, string module, CancellationToken ct)
    {
        var role = await LoadRoleAsync(userId, ct);
        if (IsUnscoped(role) || !IsInstructor(role)) return null;

        var nodes = await LoadScopeNodesAsync(userId, ct);
        return (await LoadInstructorGroupsAsync(userId, module, nodes, ct)).Select(g => g.Id).ToHashSet();
    }

    public async Task<IReadOnlyList<UserScopeGroup>> GetScopeGroupsAsync(Guid userId, CancellationToken ct)
    {
        var nodes = await LoadScopeNodesAsync(userId, ct);
        var groups = nodes
            .Where(n => n.IsActive)
            .GroupBy(n => n.RefModuleKey)
            .ToDictionary(g => g.Key, g => g.Select(n => n.RefId).ToHashSet());

        var role = await LoadRoleAsync(userId, ct);
        if (!IsUnscoped(role) && IsInstructor(role))
        {
            foreach (var moduleKey in FacilityModuleRegistry.Prefix.Keys.Concat(["sessions", "events", "halls"]))
            {
                var derived = await DeriveInstructorRefIdsAsync(userId, moduleKey, nodes, ct);
                if (derived.Count == 0) continue;
                if (!groups.TryGetValue(moduleKey, out var set)) groups[moduleKey] = set = [];
                set.UnionWith(derived);
            }
        }

        return groups
            .Select(g => new UserScopeGroup(g.Key, g.Value.ToList()))
            .ToList();
    }

    public async Task<HashSet<Guid>?> GetScopedParticipantIdsAsync(Guid userId, CancellationToken ct)
    {
        var role = await LoadRoleAsync(userId, ct);
        if (IsUnscoped(role)) return null;

        var nodes = await LoadScopeNodesAsync(userId, ct);

        var sessionIds = nodes.Where(n => n.IsActive && n.RefModuleKey == "sessions").Select(n => n.RefId).ToHashSet();
        var travelIds = nodes.Where(n => n.IsActive && n.RefModuleKey == "travels").Select(n => n.RefId).Distinct().ToList();
        var groupIds = nodes.Where(n => n.IsActive && n.RefModuleKey == "groups").Select(n => n.RefId).ToHashSet();

        if (IsInstructor(role))
        {
            sessionIds.UnionWith(await DeriveInstructorRefIdsAsync(userId, "sessions", nodes, ct));
            groupIds.UnionWith((await LoadInstructorGroupsAsync(userId, null, nodes, ct)).Select(g => g.Id));
        }

        var result = new HashSet<Guid>();
        if (sessionIds.Count > 0)
            result.UnionWith(await uow.EventApplications.GetParticipantIdsBySessionsAsync([.. sessionIds], ct));
        if (travelIds.Count > 0)
            result.UnionWith(await uow.TravelApplications.GetParticipantIdsByTravelsAsync(travelIds, ct));
        if (groupIds.Count > 0)
            result.UnionWith(await uow.FacilityRegistrations.GetParticipantIdsByGroupsAsync([.. groupIds], ct));

        return result;
    }

    public async Task<HashSet<string>?> GetScopedNamesAsync(Guid userId, string moduleKey, CancellationToken ct)
    {
        if (IsUnscoped(await LoadRoleAsync(userId, ct))) return null;

        var nodes = await LoadScopeNodesAsync(userId, ct);
        if (nodes.Count == 0) return [];

        return nodes
            .Where(n => n.IsActive && n.RefModuleKey == moduleKey && !string.IsNullOrWhiteSpace(n.Name))
            .Select(n => n.Name)
            .ToHashSet();
    }

    private async Task<HashSet<Guid>> DeriveInstructorRefIdsAsync(Guid userId, string moduleKey, List<ScopeNode> nodes, CancellationToken ct)
    {
        if (FacilityModuleRegistry.Prefix.ContainsKey(moduleKey))
            return (await LoadInstructorGroupsAsync(userId, moduleKey, nodes, ct)).Select(g => g.FacilityId).ToHashSet();

        if (moduleKey is not ("sessions" or "events" or "halls")) return [];

        var nodeSessionIds = nodes.Where(n => n.IsActive && n.RefModuleKey == "sessions").Select(n => n.RefId).ToList();
        var sessions = await uow.Sessions.FindAsync(s => s.InstructorId == userId || nodeSessionIds.Contains(s.Id), ct);
        if (moduleKey == "sessions") return sessions.Select(s => s.Id).ToHashSet();

        var eventIds = sessions.Select(s => s.EventId)
            .Concat(nodes.Where(n => n.IsActive && n.RefModuleKey == "events").Select(n => n.RefId))
            .ToHashSet();
        if (moduleKey == "events") return eventIds;

        var events = eventIds.Count == 0 ? [] : await uow.Events.FindAsync(e => eventIds.Contains(e.Id), ct);
        return sessions.Select(s => s.HallId)
            .Concat(events.Select(e => e.HallId))
            .OfType<Guid>()
            .ToHashSet();
    }

    private async Task<List<FacilityGroup>> LoadInstructorGroupsAsync(Guid userId, string? module, List<ScopeNode> nodes, CancellationToken ct)
    {
        var instructorIds = (await uow.FacilityInstructors.FindAsync(i => i.UserId == userId && (module == null || i.Module == module), ct))
            .Select(i => i.Id)
            .ToList();
        var nodeGroupIds = nodes.Where(n => n.IsActive && n.RefModuleKey == "groups").Select(n => n.RefId).ToList();
        if (instructorIds.Count == 0 && nodeGroupIds.Count == 0) return [];

        var assigned = await uow.FacilityGroups.FindAsync(g =>
            (module == null || g.Module == module) &&
            ((g.InstructorId != null && instructorIds.Contains(g.InstructorId.Value)) || nodeGroupIds.Contains(g.Id)), ct);
        if (assigned.Count == 0) return [];

        var assignedIds = assigned.Select(g => g.Id).ToList();
        var parentIds = assigned.Where(g => g.ParentGroupId.HasValue).Select(g => g.ParentGroupId!.Value).ToList();
        var related = await uow.FacilityGroups.FindAsync(g =>
            (g.ParentGroupId != null && assignedIds.Contains(g.ParentGroupId.Value)) || parentIds.Contains(g.Id), ct);

        return assigned.Concat(related).DistinctBy(g => g.Id).ToList();
    }

    private async Task<UserAccess> LoadRoleAsync(Guid userId, CancellationToken ct)
    {
        var user = await uow.AdminUsers.GetByIdAsync(userId, ct);
        if (user is null) return new UserAccess(true, false);
        var role = await uow.Roles.GetByIdAsync(user.RoleId, ct);
        return new UserAccess(role?.IsSuperAdmin == true, role?.Key == InstructorRoleKey);
    }

    private static bool IsUnscoped(UserAccess access) => access.Unscoped;

    private static bool IsInstructor(UserAccess access) => access.Instructor;

    private sealed record UserAccess(bool Unscoped, bool Instructor);

    private async Task<List<ScopeNode>> LoadScopeNodesAsync(Guid userId, CancellationToken ct)
    {
        var scopes = await uow.AdminScopes.GetByAdminUserAsync(userId, ct);
        if (scopes.Count == 0) return [];

        var nodeIds = scopes.Select(s => s.ScopeNodeId).Distinct().ToList();
        return await uow.ScopeNodes.GetByIdsAsync(nodeIds, ct);
    }
}

public static class InstructorScopeExtensions
{
    public static Task<HashSet<Guid>?> GetInstructorGroupIdsAsync(this IUserScopeService userScope, ICurrentUser current, string module, CancellationToken ct)
        => current.Id is Guid userId ? userScope.GetInstructorGroupIdsAsync(userId, module, ct) : Task.FromResult<HashSet<Guid>?>(null);

    public static async Task EnsureInstructorGroupAsync(this IUserScopeService userScope, ICurrentUser current, string module, Guid? groupId, CancellationToken ct)
    {
        var groups = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        if (groups is not null && (groupId is null || !groups.Contains(groupId.Value)))
            throw new ForbiddenException("Bu programa erişim yetkiniz yok. Yalnızca atandığınız programları görebilirsiniz.", "GROUP_OUT_OF_SCOPE");
    }
}
