using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Entities.Seda;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class MeSedaServiceTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ISedaApplicationRepository> _sedaApps = new();
    private readonly Mock<IParticipantRepository> _participants = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<ISedaSettingsService> _settings = new();
    private readonly Mock<ISedaDefinitionService> _definitions = new();
    private readonly Mock<ISedaSchoolService> _schools = new();
    private readonly Mock<IActivityLogger> _log = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly MeSedaService _service;
    private readonly Guid _citizenId = Guid.NewGuid();
    private const string Tckn = "11111111110";

    public MeSedaServiceTests()
    {
        _uow.SetupGet(x => x.SedaApplications).Returns(_sedaApps.Object);
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _uow.SetupGet(x => x.HasActiveTransaction).Returns(true);
        _uow.Setup(x => x.AcquireAdvisoryLockAsync(It.IsAny<long>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _settings.Setup(x => x.GetAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SedaSettingsDto(ApplicationsOpen: true, RequireApproval: false, AutoCloseWhenFull: false, ActivePeriod: null));
        _schools.Setup(x => x.GetOptionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _definitions.Setup(x => x.GetOptionsAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);

        _currentUser.SetupGet(x => x.Id).Returns(_citizenId);
        _currentUser.SetupGet(x => x.Name).Returns("Test Görevli");

        _participants.Setup(x => x.GetByIdAsync(_citizenId, It.IsAny<CancellationToken>())).ReturnsAsync(CreateParticipant());
        _sedaApps.Setup(x => x.NextCodeNumberAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _audit.Setup(x => x.LogAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        _service = new MeSedaService(_uow.Object, _currentUser.Object, _settings.Object,
            _definitions.Object, _schools.Object, _log.Object, _audit.Object);
    }

    [Fact]
    public async Task ApplyAsync_ayni_tckn_baska_hesapta_aktif_basvuru_varsa_dostca_hata_verir()
    {
        _sedaApps.Setup(x => x.HasActiveApplicationForCitizenAsync(_citizenId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _sedaApps.Setup(x => x.HasActiveApplicationForTcknAsync(Tckn, It.IsAny<Guid?>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.ApplyAsync(Request(), CancellationToken.None));

        Assert.Equal("SEDA_ALREADY_APPLIED", ex.ErrorCode);
        _sedaApps.Verify(x => x.AddAsync(It.IsAny<SedaApplication>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ApplyAsync_tckn_ve_hesap_temizse_basvuru_olusturur()
    {
        _sedaApps.Setup(x => x.HasActiveApplicationForCitizenAsync(_citizenId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);
        _sedaApps.Setup(x => x.HasActiveApplicationForTcknAsync(Tckn, It.IsAny<Guid?>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var dto = await _service.ApplyAsync(Request(), CancellationToken.None);

        Assert.Equal(Tckn, dto.Tckn);
        _sedaApps.Verify(x => x.AddAsync(It.Is<SedaApplication>(a => a.Tckn == Tckn), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApplyAsync_kendi_hesabinda_aktif_basvuru_varsa_dostca_hata_verir()
    {
        _sedaApps.Setup(x => x.HasActiveApplicationForCitizenAsync(_citizenId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _sedaApps.Setup(x => x.HasActiveApplicationForTcknAsync(It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.ApplyAsync(Request(), CancellationToken.None));

        Assert.Equal("SEDA_ALREADY_APPLIED", ex.ErrorCode);
        _sedaApps.Verify(x => x.AddAsync(It.IsAny<SedaApplication>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static CitizenSedaApplyRequest Request()
        => new("Test Okulu", "8. Sınıf", "LGS", "Merkez", null);

    private static Participant CreateParticipant()
        => Participant.Create(Tckn, "Ali Veli", new DateTime(2012, 5, 1), Gender.Male, true,
            "hash", null, "05551112233", "05334445566", null, "Sultangazi");
}
