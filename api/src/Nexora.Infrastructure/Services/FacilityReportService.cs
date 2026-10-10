using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Infrastructure.Services;

public class FacilityReportService(IUnitOfWork uow, ICurrentUser current, IUserScopeService userScope) : IFacilityReportService
{
    public async Task<FacilityReportSummaryDto> GetSummaryAsync(string module, CancellationToken ct)
    {
        var groups = await uow.FacilityGroups.GetActiveWithInstructorByModuleAsync(module, ct);
        var (main, _) = await uow.FacilityRegistrations.GetModuleParticipantCountsAsync(module, ct);
        var stats = await uow.FacilityAttendances.GetGroupAttendanceStatsAsync(module, ct);

        var instructorGroupIds = await userScope.GetInstructorGroupIdsAsync(current, module, ct);
        if (instructorGroupIds is not null)
        {
            groups = groups.Where(g => instructorGroupIds.Contains(g.Id)).ToList();
            stats = stats.Where(s => instructorGroupIds.Contains(s.GroupId)).ToList();
            main = groups.Sum(g => g.RegisteredCount);
        }
        var statByGroup = stats.ToDictionary(s => s.GroupId);

        var totalPresent = stats.Sum(s => s.Present);
        var totalMarked = stats.Sum(s => s.Total);
        var attendanceRate = totalMarked > 0 ? (int)Math.Round(100.0 * totalPresent / totalMarked) : 0;

        var branchIds = groups.Select(g => g.BranchId).Distinct().ToList();
        var branches = branchIds.Count > 0 ? await uow.FacilityBranches.FindAsync(b => branchIds.Contains(b.Id), ct) : new();
        var branchNames = branches.ToDictionary(b => b.Id, b => b.Name);

        var topGroups = groups
            .OrderByDescending(g => g.Capacity > 0 ? (double)g.RegisteredCount / g.Capacity : 0)
            .ThenByDescending(g => g.RegisteredCount)
            .Take(5)
            .Select(g => new ReportTopGroupDto(
                g.Name,
                branchNames.GetValueOrDefault(g.BranchId, ""),
                g.RegisteredCount,
                g.Capacity > 0 ? (int)Math.Round(100.0 * g.RegisteredCount / g.Capacity) : 0))
            .ToList();

        var instructorPerformance = groups
            .Where(g => g.InstructorId.HasValue)
            .GroupBy(g => new { g.InstructorId, g.InstructorName })
            .Select(grp =>
            {
                var grpGroups = grp.ToList();
                var present = grpGroups.Sum(g => statByGroup.TryGetValue(g.Id, out var s) ? s.Present : 0);
                var total = grpGroups.Sum(g => statByGroup.TryGetValue(g.Id, out var s) ? s.Total : 0);
                return new ReportInstructorDto(
                    grp.Key.InstructorName ?? "",
                    grpGroups.Count,
                    grpGroups.Sum(g => g.RegisteredCount),
                    total > 0 ? (int)Math.Round(100.0 * present / total) : 0);
            })
            .OrderByDescending(i => i.Participants)
            .ToList();

        return new FacilityReportSummaryDto(main, groups.Count, attendanceRate, topGroups, instructorPerformance);
    }
}
