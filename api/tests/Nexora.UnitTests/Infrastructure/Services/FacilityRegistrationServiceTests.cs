using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class FacilityRegistrationServiceTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IFacilityGroupRepository> _groups = new();
    private readonly Mock<IFacilityRegistrationRepository> _registrations = new();
    private readonly Mock<IFacilityApplicationRepository> _applications = new();
    private readonly Mock<IFacilityNotificationService> _notification = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<IExcelService> _excel = new();
    private readonly Mock<IFacilitySettingsRepository> _settings = new();
    private readonly Mock<IParticipantRepository> _participants = new();
    private readonly Mock<IFacilityParticipationLimitGuard> _limitGuard = new();
    private readonly Mock<IFacilityCrossProgramLimitGuard> _crossProgramGuard = new();
    private readonly Microsoft.Extensions.Configuration.IConfiguration _config =
        new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build();
    private readonly FacilityRegistrationService _service;

    public FacilityRegistrationServiceTests()
    {
        _uow.SetupGet(x => x.FacilityGroups).Returns(_groups.Object);
        _uow.SetupGet(x => x.FacilityRegistrations).Returns(_registrations.Object);
        _uow.SetupGet(x => x.FacilityApplications).Returns(_applications.Object);
        _uow.SetupGet(x => x.FacilitySettings).Returns(_settings.Object);
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _participants.Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Participants.Participant?)null);
        _participants.Setup(x => x.GetByTcknAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Participants.Participant?)null);
        _settings.Setup(x => x.GetGeneralAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((FacilitySettingsRecord?)null);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupGet(x => x.Id).Returns((Guid?)null);
        _limitGuard.Setup(x => x.EnsureWithinLimitAsync(It.IsAny<string>(), It.IsAny<FacilityGroup>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<DateTime?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _crossProgramGuard.Setup(x => x.EnsureAllowedAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _service = new FacilityRegistrationService(_uow.Object, _currentUser.Object, _notification.Object, _excel.Object, _userScope.Object, _config, _limitGuard.Object, _crossProgramGuard.Object);
    }

    [Fact]
    public async Task RegisterAsync_kapasitede_yer_varsa_main_kaydi_olusturur()
    {
        var group = CreateGroup(capacity: 2, reserveCapacity: 1);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.SetupSequence(x => x.GetCountsByGroupAsync(group.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((1, 0))
            .ReturnsAsync((2, 0));
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var result = await _service.RegisterAsync("sports", Request(group.Id), CancellationToken.None);

        Assert.Equal("main", result.Kind);
        Assert.Equal(0, result.WaitlistOrder);
        _registrations.Verify(x => x.AddAsync(It.Is<FacilityRegistration>(r =>
            r.GroupId == group.Id && r.Kind == "main" && r.Tckn == "12345678901"), It.IsAny<CancellationToken>()), Times.Once);
        _groups.Verify(x => x.Update(It.Is<FacilityGroup>(g => g.RegisteredCount == 2 && g.WaitlistCount == 0)), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ana_kontenjan_doluysa_rezerve_alir()
    {
        var group = CreateGroup(capacity: 1, reserveCapacity: 2);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.Setup(x => x.GetCountsByGroupAsync(group.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((1, 1));
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var result = await _service.RegisterAsync("sports", Request(group.Id), CancellationToken.None);

        Assert.Equal("reserve", result.Kind);
        Assert.Equal(2, result.WaitlistOrder);
        _registrations.Verify(x => x.AddAsync(It.Is<FacilityRegistration>(r =>
            r.Kind == "reserve" && r.WaitlistOrder == 2), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ana_ve_yedek_kontenjan_doluysa_conflict_firlatir()
    {
        var group = CreateGroup(capacity: 1, reserveCapacity: 1);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.Setup(x => x.GetCountsByGroupAsync(group.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((1, 1));
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync("sports", Request(group.Id), CancellationToken.None));

        Assert.Equal("QUOTA_FULL", ex.ErrorCode);
        _registrations.Verify(x => x.AddAsync(It.IsAny<FacilityRegistration>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_QA_madde74_ReserveCapacity_sifirsa_sinirsiz_yedek_kabul_etmez()
    {
        // Regresyon kilidi (2026-09-23, QA madde 74): ReserveCapacity=0 gercek sifirdir,
        // "sinirsiz yedek" degildir. Ana kontenjan (Capacity=1) dolduktan sonra
        // ReserveCapacity=0 olan bir grupta ikinci basvuru reddedilmeli - fix oncesi bu
        // durum sessizce "reserve" olarak kabul ediliyordu (waitlistCount(0) < ReserveCapacity(0)
        // her zaman false olmasi gerekirken eski kod "ReserveCapacity<=0 || ..." ile bunu atliyordu).
        var group = CreateGroup(capacity: 1, reserveCapacity: 0);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.Setup(x => x.GetCountsByGroupAsync(group.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((1, 0));
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync("sports", Request(group.Id), CancellationToken.None));

        Assert.Equal("QUOTA_FULL", ex.ErrorCode);
        _registrations.Verify(x => x.AddAsync(It.IsAny<FacilityRegistration>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_ayni_grupta_aktif_kayit_varsa_conflict_firlatir()
    {
        var group = CreateGroup(capacity: 10, reserveCapacity: 0);
        var existing = FacilityRegistration.Create("sports", group.FacilityId, group.Id, group.BranchId, null, null,
            "Mevcut Kisi", "12345678901", "5551112233", null, null, "main", 0, group.PeriodEnd, group.PeriodStart);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([existing]);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync("sports", Request(group.Id), CancellationToken.None));

        Assert.Equal("ALREADY_REGISTERED", ex.ErrorCode);
    }

    [Fact]
    public async Task RegisterAsync_ayni_gun_baska_aktif_program_varsa_conflict_firlatir()
    {
        const string mondaySchedule = "[{\"day\":\"monday\",\"startTime\":\"10:00\",\"endTime\":\"11:00\"}]";
        var target = CreateGroup(capacity: 10, reserveCapacity: 0, scheduleJson: mondaySchedule);
        var other = CreateGroup(capacity: 10, reserveCapacity: 0, scheduleJson: mondaySchedule);
        var otherReg = FacilityRegistration.Create("sports", other.FacilityId, other.Id, other.BranchId, null, null,
            "Test Kisi", "12345678901", "5551112233", null, null, "main", 0, other.PeriodEnd, other.PeriodStart);
        _groups.Setup(x => x.GetByIdAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync(target);
        _groups.Setup(x => x.GetByIdAsync(other.Id, It.IsAny<CancellationToken>())).ReturnsAsync(other);
        _registrations.Setup(x => x.GetByGroupAsync(target.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([otherReg]);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync("sports", Request(target.Id), CancellationToken.None));

        Assert.Equal("SAME_DAY_CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task RegisterAsync_hedef_yedek_ise_asil_bos_olsa_da_yedege_sona_ekler()
    {
        var group = CreateGroup(capacity: 10, reserveCapacity: 5);
        var existingReserve = FacilityRegistration.Create("sports", group.FacilityId, group.Id, group.BranchId, null, null,
            "Yedek Kisi", "11111111111", "5551112233", null, null, "reserve", 3, null, null);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([existingReserve]);
        _registrations.Setup(x => x.GetCountsByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync((0, 2));
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var result = await _service.RegisterAsync("sports", Request(group.Id) with { Target = "reserve" }, CancellationToken.None);

        Assert.Equal("reserve", result.Kind);
        Assert.Equal(4, result.WaitlistOrder);
    }

    [Fact]
    public async Task RegisterAsync_hedef_yedek_ve_yedek_kontenjani_sifirsa_conflict()
    {
        var group = CreateGroup(capacity: 10, reserveCapacity: 0);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync("sports", Request(group.Id) with { Target = "reserve" }, CancellationToken.None));

        Assert.Equal("QUOTA_FULL", ex.ErrorCode);
        _registrations.Verify(x => x.AddAsync(It.IsAny<FacilityRegistration>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_hedef_asil_ve_kontenjan_doluysa_yedege_dusurmez()
    {
        var group = CreateGroup(capacity: 1, reserveCapacity: 5);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _registrations.Setup(x => x.GetCountsByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync((1, 0));
        _registrations.Setup(x => x.GetActiveMainByTcknAsync("12345678901", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RegisterAsync("sports", Request(group.Id) with { Target = "main" }, CancellationToken.None));

        Assert.Equal("QUOTA_FULL", ex.ErrorCode);
        _registrations.Verify(x => x.AddAsync(It.IsAny<FacilityRegistration>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static RegisterParticipantRequest Request(Guid groupId) => new(
        groupId, null, Guid.NewGuid(), "Test Kisi", "12345678901", "5551112233", new DateTime(2010, 1, 1), "5559998877");

    private static FacilityGroup CreateGroup(int capacity, int reserveCapacity, string scheduleJson = "[]")
    {
        var id = Guid.NewGuid();
        var group = FacilityGroup.Create(new FacilityGroupData(
            "sports", Guid.NewGuid(), Guid.NewGuid(), null, "Basketbol", "kurs", "mixed", capacity, reserveCapacity,
            7, 65, scheduleJson, "full", "{}", "{}", DateTime.UtcNow.Date.AddDays(-1), DateTime.UtcNow.Date.AddMonths(1),
            3, 2, 10, null, null, true, null, "date_range", 0, 0, null, null, false, true, false, "unlimited", 0), null);
        SetId(group, id);
        return group;
    }

    private static void SetId(object entity, Guid id)
    {
        var prop = entity.GetType().BaseType?.GetProperty("Id") ?? entity.GetType().GetProperty("Id");
        prop?.SetValue(entity, id);
    }
}
