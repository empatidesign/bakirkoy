using System.Linq.Expressions;
using Moq;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class FacilityGroupCountTests
{
    public static IEnumerable<object[]> Modules => FacilityModuleRegistry.All.Select(m => new object[] { m });

    [Theory]
    [MemberData(nameof(Modules))]
    public async Task List_and_detail_use_actual_waitlist_including_child_totals(string module)
    {
        var group = Group(module, null);
        var child = Group(module, group.Id);
        group.SetCounts(2, 6);
        child.SetCounts(2, 10);
        var uow = new Mock<IUnitOfWork> { DefaultValue = DefaultValue.Mock };
        uow.Setup(x => x.FacilityGroups.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        uow.Setup(x => x.FacilityGroups.GetPagedAsync(module, It.IsAny<FacilityGroupListParams>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<FacilityGroup> { Items = [group], Total = 1, Page = 1, Limit = 20 });
        uow.Setup(x => x.FacilityGroups.FindAsync(It.IsAny<Expression<Func<FacilityGroup, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([child]);
        uow.Setup(x => x.Facilities.FindAsync(It.IsAny<Expression<Func<Facility, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        uow.Setup(x => x.FacilityBranches.FindAsync(It.IsAny<Expression<Func<FacilityBranch, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        uow.Setup(x => x.FacilityApplications.FindAsync(It.IsAny<Expression<Func<FacilityApplication, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        uow.Setup(x => x.FacilitySessions.CountActiveByGroupsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new Dictionary<Guid, int>());
        uow.Setup(x => x.FacilityRegistrations.CountActiveWaitlistByGroupsAsync(
            It.Is<IReadOnlyCollection<Guid>>(ids => ids.Contains(group.Id) && ids.Contains(child.Id)), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int> { [group.Id] = 2 });
        var service = new FacilityGroupService(uow.Object, Mock.Of<ICurrentUser>(), Mock.Of<IFacilitySessionService>(),
            Mock.Of<IScopedStaffService>(), Mock.Of<IAuditService>(), Mock.Of<IUserScopeService>());

        var detail = await service.GetByIdAsync(module, group.Id, default);
        var list = await service.GetPagedAsync(module, new FacilityGroupListParams(), default);
        Assert.Equal(2, detail.WaitlistCount);
        Assert.Equal(0, detail.SubGroupWaitlist);
        Assert.Equal(2, Assert.Single(list.Items).WaitlistCount);
        Assert.Equal(0, list.Items[0].SubGroupWaitlist);
        Assert.Equal(6, group.WaitlistCount); // Reading must not mutate stored entities.
        uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private static FacilityGroup Group(string module, Guid? parent) => FacilityGroup.Create(new FacilityGroupData(
        module, Guid.NewGuid(), Guid.NewGuid(), parent, "Count regression", "kurs", "mixed", 2, 2,
        0, 99, "[]", "full", "{}", "{}", DateTime.UtcNow.Date, DateTime.UtcNow.Date.AddMonths(1),
        3, 2, 10, null, null, true, null, "date_range", 0, 0, null, null, false, true, false, "unlimited", 0), null);
}
