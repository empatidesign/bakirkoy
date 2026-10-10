using System.Linq.Expressions;
using System.Text.Json;
using Moq;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Kullanıcı isteği (2026-10-01): bir grup/seans aynı gün/saatte başka tesis(ler)de de
// yürütülebiliyor — admin kaynak kaydı hedef tesis(ler)e kopyalayabilmeli. Kopya daima
// pasif oluşmalı (sıfır-hata ilkesi: yanlış kontenjan/branşla yanlışlıkla katılımcı almasın).
public class FacilityGroupCopyTests
{
    private const string Module = "women-family";

    private static (FacilityGroupService Service, Mock<IUnitOfWork> Uow) MakeService()
    {
        var uow = new Mock<IUnitOfWork> { DefaultValue = DefaultValue.Mock };
        var audit = new Mock<IAuditService>();
        var service = new FacilityGroupService(uow.Object, Mock.Of<ICurrentUser>(), Mock.Of<IFacilitySessionService>(),
            Mock.Of<IScopedStaffService>(), audit.Object, Mock.Of<IUserScopeService>());
        return (service, uow);
    }

    private static FacilityGroup SourceGroup(Guid facilityId, Guid branchId, Guid? parentGroupId = null)
    {
        var schedule = JsonSerializer.Deserialize<JsonElement>("""[{"day":"monday","startTime":"10:00","endTime":"11:00"}]""");
        var fee = JsonSerializer.Deserialize<JsonElement>("{}");
        var conditions = JsonSerializer.Deserialize<JsonElement>("{}");
        return FacilityGroup.Create(new FacilityGroupData(
            Module, facilityId, branchId, parentGroupId, "El Sanatları Kursu", "kurs", "mixed", 20, 5,
            15, 80, schedule.GetRawText(), "full", fee.GetRawText(), conditions.GetRawText(),
            DateTime.UtcNow.Date, DateTime.UtcNow.Date.AddMonths(3),
            3, 2, 10, null, null, true, null, "date_range", 0, 3, null, null, false, true, false, "unlimited", 0), "tester");
    }

    private static Facility MakeFacility(Guid id, string name, int capacity = 0, bool isActive = true)
    {
        var facility = Facility.Create(new FacilityData(Module, name, "indoor", null, capacity, null, null, null, null, null, null, null, isActive), "FAC-001", "tester");
        facility.Id = id;
        return facility;
    }

    [Fact]
    public async Task Copy_creates_inactive_group_with_suffixed_name_in_target_facility()
    {
        var (service, uow) = MakeService();
        var sourceFacilityId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var targetFacilityId = Guid.NewGuid();
        var source = SourceGroup(sourceFacilityId, branchId);

        uow.Setup(x => x.FacilityGroups.GetByIdAsync(source.Id, It.IsAny<CancellationToken>())).ReturnsAsync(source);
        uow.Setup(x => x.FacilityBranches.GetByIdAsync(branchId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(FacilityBranch.Create(new FacilityBranchData(Module, "El Sanatları", "", 3, 2, 10, true), "tester"));
        var targetFacility = MakeFacility(targetFacilityId, "Hedef Merkez");
        uow.Setup(x => x.Facilities.GetByIdAsync(targetFacilityId, It.IsAny<CancellationToken>())).ReturnsAsync(targetFacility);

        FacilityGroup? added = null;
        uow.Setup(x => x.FacilityGroups.AddAsync(It.IsAny<FacilityGroup>(), It.IsAny<CancellationToken>()))
            .Callback<FacilityGroup, CancellationToken>((g, _) => added = g)
            .Returns(Task.CompletedTask);

        var result = await service.CopyAsync(Module, source.Id, new CopyFacilityGroupRequest([targetFacilityId]), default);

        var item = Assert.Single(result.Results);
        Assert.True(item.Success);
        Assert.Equal(targetFacilityId, item.FacilityId);
        Assert.NotNull(added);
        Assert.Equal("El Sanatları Kursu (Kopya)", added!.Name);
        Assert.False(added.IsActive);
        Assert.Equal(targetFacilityId, added.FacilityId);
        Assert.Equal(branchId, added.BranchId);
        Assert.Null(added.ParentGroupId);
        Assert.Equal(source.Capacity, added.Capacity);
        Assert.Equal(source.ScheduleJson, added.ScheduleJson);
        uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task Copy_to_multiple_facilities_reports_per_target_result_and_continues_on_partial_failure()
    {
        var (service, uow) = MakeService();
        var sourceFacilityId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var okFacilityId = Guid.NewGuid();
        var missingFacilityId = Guid.NewGuid();
        var source = SourceGroup(sourceFacilityId, branchId);

        uow.Setup(x => x.FacilityGroups.GetByIdAsync(source.Id, It.IsAny<CancellationToken>())).ReturnsAsync(source);
        uow.Setup(x => x.FacilityBranches.GetByIdAsync(branchId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(FacilityBranch.Create(new FacilityBranchData(Module, "El Sanatları", "", 3, 2, 10, true), "tester"));
        uow.Setup(x => x.Facilities.GetByIdAsync(okFacilityId, It.IsAny<CancellationToken>())).ReturnsAsync(MakeFacility(okFacilityId, "Tesis A"));
        uow.Setup(x => x.Facilities.GetByIdAsync(missingFacilityId, It.IsAny<CancellationToken>())).ReturnsAsync((Facility?)null);

        var result = await service.CopyAsync(Module, source.Id, new CopyFacilityGroupRequest([okFacilityId, missingFacilityId]), default);

        Assert.Equal(2, result.Results.Count);
        Assert.True(result.Results.Single(r => r.FacilityId == okFacilityId).Success);
        Assert.False(result.Results.Single(r => r.FacilityId == missingFacilityId).Success);
        Assert.NotNull(result.Results.Single(r => r.FacilityId == missingFacilityId).Error);
    }

    [Fact]
    public async Task Copy_rejects_capacity_exceeding_target_facility_capacity()
    {
        var (service, uow) = MakeService();
        var sourceFacilityId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var targetFacilityId = Guid.NewGuid();
        var source = SourceGroup(sourceFacilityId, branchId); // capacity 20

        uow.Setup(x => x.FacilityGroups.GetByIdAsync(source.Id, It.IsAny<CancellationToken>())).ReturnsAsync(source);
        uow.Setup(x => x.FacilityBranches.GetByIdAsync(branchId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(FacilityBranch.Create(new FacilityBranchData(Module, "El Sanatları", "", 3, 2, 10, true), "tester"));
        // Hedef tesisin kapasitesi kaynaktaki grup kontenjanından (20) küçük (10).
        uow.Setup(x => x.Facilities.GetByIdAsync(targetFacilityId, It.IsAny<CancellationToken>())).ReturnsAsync(MakeFacility(targetFacilityId, "Küçük Tesis", capacity: 10));

        var result = await service.CopyAsync(Module, source.Id, new CopyFacilityGroupRequest([targetFacilityId]), default);

        var item = Assert.Single(result.Results);
        Assert.False(item.Success);
        Assert.Contains("kapasite", item.Error, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Copy_rejects_subgroups_directly()
    {
        var (service, uow) = MakeService();
        var facilityId = Guid.NewGuid();
        var branchId = Guid.NewGuid();
        var parentId = Guid.NewGuid();
        var subGroup = SourceGroup(facilityId, branchId, parentGroupId: parentId);

        uow.Setup(x => x.FacilityGroups.GetByIdAsync(subGroup.Id, It.IsAny<CancellationToken>())).ReturnsAsync(subGroup);

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CopyAsync(Module, subGroup.Id, new CopyFacilityGroupRequest([Guid.NewGuid()]), default));
    }

    [Fact]
    public async Task Copy_requires_at_least_one_target_facility()
    {
        var (service, uow) = MakeService();
        var source = SourceGroup(Guid.NewGuid(), Guid.NewGuid());
        uow.Setup(x => x.FacilityGroups.GetByIdAsync(source.Id, It.IsAny<CancellationToken>())).ReturnsAsync(source);

        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CopyAsync(Module, source.Id, new CopyFacilityGroupRequest([]), default));
    }
}
