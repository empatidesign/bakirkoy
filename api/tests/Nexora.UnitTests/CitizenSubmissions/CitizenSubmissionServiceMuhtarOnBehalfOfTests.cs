using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.CitizenSubmissions.Dtos;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.Nvi.Dtos;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.CitizenSubmissions;

/// <summary>
/// Kullanıcı isteği (2026-09-07): "kişi başkası adına yapılacaksa muhtar burdan talep
/// oluştururken kişinin bilgilerini form içinde girecek, TC kimlik doğum tarihi girdiğinde
/// kişinin bilgileri NVI ile entegreli çekilecek ... gönder dediğimizde o kişi sistemde üye
/// ise o kişinin panelinde otomatik görünecek, değilse kişinin cep telefonu iletişim bilgisi
/// de girilmesi lazım". Bu testler CreateByMuhtarAsync'in OnBehalfOf=true dalını ve
/// MuhtarNviLookupAsync'i kapsar.
/// </summary>
public class CitizenSubmissionServiceMuhtarOnBehalfOfTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<ICurrentUser> _current = new();
    private readonly Mock<IUserScopeService> _scopeService = new();
    private readonly Mock<IScopedStaffService> _scopedStaff = new();
    private readonly Mock<IUlakbelForwardService> _ulakbelForward = new();
    private readonly Mock<IIntegrationSettingsService> _integrationSettings = new();
    private readonly Mock<INotificationService> _notificationService = new();
    private readonly Mock<INotificationDispatcher> _dispatcher = new();
    private readonly Mock<IModuleNotificationSettingsService> _moduleSettings = new();
    private readonly Mock<ISubmissionContentAnalyzer> _contentAnalyzer = new();
    private readonly Mock<INviService> _nvi = new();
    private readonly Mock<IFileStorageService> _fileStorage = new();
    private readonly Mock<ISmsService> _sms = new();
    private readonly Mock<ISmsGovernanceService> _smsGovernance = new();
    private readonly Mock<ICitizenSubmissionRepository> _submissions = new();
    private readonly Mock<IScopeNodeRepository> _scopeNodes = new();
    private readonly Mock<IRedisService> _redis = new();
    private readonly CitizenSubmissionService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();
    private const string Neighborhood = "Cumhuriyet Mahallesi";
    private const string ValidTckn = "12345678950";

    public CitizenSubmissionServiceMuhtarOnBehalfOfTests()
    {
        _current.SetupGet(x => x.Id).Returns(AdminUserId);
        _scopeService.Setup(x => x.GetScopedNamesAsync(AdminUserId, "muhtarlik", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string> { Neighborhood });
        _uow.SetupGet(x => x.CitizenSubmissions).Returns(_submissions.Object);
        _submissions.Setup(x => x.AddAsync(It.IsAny<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _uow.Setup(x => x.AdminUsers.GetByIdAsync(AdminUserId, It.IsAny<CancellationToken>())).ReturnsAsync((Nexora.Domain.Entities.Auth.AdminUser?)null);
        // FindMuhtarAdminAsync (MapDtoAsync tarafından çağrılır) — testte gerçek bir muhtar
        // hesabı bulmayı simüle etmiyoruz, yalnızca null dönüp NRE atmamasını sağlıyoruz.
        _uow.SetupGet(x => x.ScopeNodes).Returns(_scopeNodes.Object);
        _scopeNodes.Setup(x => x.GetByRefAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Authority.ScopeNode?)null);

        _service = new CitizenSubmissionService(
            _uow.Object, _audit.Object, _current.Object, _scopeService.Object,
            _scopedStaff.Object, _ulakbelForward.Object, _integrationSettings.Object,
            _notificationService.Object, _dispatcher.Object, _moduleSettings.Object,
            _contentAnalyzer.Object, _nvi.Object, _fileStorage.Object, _sms.Object, _smsGovernance.Object,
            _redis.Object, new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<CitizenSubmissionService>.Instance);
    }

    private static Participant MakeParticipant(string tckn, string fullName, string? phone, string? address)
        => Participant.Create(tckn, fullName, new DateTime(1990, 5, 1), Gender.Male, false, "hash", null, phone, null, null, address);

    private CreateSubmissionByMuhtarRequest BaseRequest(string addressType = "residence", string? address = null, string? citizenPhone = null)
        => new("Su kesintisi", "3 gündür su yok.", "infrastructure", "complaint", "high", address ?? "", null, null,
            OnBehalfOf: true, CitizenTc: ValidTckn, CitizenBirthDate: new DateTime(1990, 5, 1),
            CitizenPhone: citizenPhone, AddressType: addressType);

    [Fact]
    public async Task CreateByMuhtarAsync_kayitli_vatandas_icin_ad_ve_telefon_participanttan_gelir()
    {
        var participant = MakeParticipant(ValidTckn, "Ayşe Yılmaz", "05551112233", "Cumhuriyet Mah. Gül Sk. No:5");
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission? captured = null;
        _submissions.Setup(x => x.AddAsync(It.IsAny<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission>(), It.IsAny<CancellationToken>()))
            .Callback<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        // Kayıtlı vatandaşın telefonu "05551112233" iken muhtarın formda YANLIŞLIKLA
        // farklı bir telefon girmiş olması ihtimaline karşı: kayıtlı telefon esastır.
        var req = BaseRequest(citizenPhone: "05559998877");
        var result = await _service.CreateByMuhtarAsync(req, CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal("Ayşe Yılmaz", captured!.CitizenName);
        Assert.Equal("05551112233", captured.CitizenPhone);
        Assert.Equal(ValidTckn, captured.CitizenTc);
        Assert.Equal("Cumhuriyet Mah. Gül Sk. No:5", captured.Address);
        Assert.False(captured.IsAnonymousToMuhtar);
        Assert.Equal("muhtar_panel", captured.SubmittedVia);
        _nvi.Verify(x => x.GetPersonAndChildrenAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateByMuhtarAsync_kayitsiz_vatandas_icin_NVI_dogrulamasi_yapilir_ve_telefon_zorunludur()
    {
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(ValidTckn, It.IsAny<DateTime>(), 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null, new NviPersonDto(ValidTckn, "Mehmet", "Kaya", new DateTime(1990, 5, 1), Gender.Male, "Bilinmeyen Sk."), []));

        // Kayıtsız + telefon boş -> reddedilmeli.
        var reqNoPhone = BaseRequest();
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.CreateByMuhtarAsync(reqNoPhone, CancellationToken.None));
        Assert.Equal("CITIZEN_PHONE_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateByMuhtarAsync_kayitsiz_vatandas_telefonla_basariyla_olusturulur()
    {
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(ValidTckn, It.IsAny<DateTime>(), 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null, new NviPersonDto(ValidTckn, "Mehmet", "Kaya", new DateTime(1990, 5, 1), Gender.Male, "NVI Adres Sk."), []));
        _nvi.Setup(x => x.GetAddressAsync(ValidTckn, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviAddressResponse(true, null, new NviAddressDto("NVI Adres Sk. No:1", "İstanbul", "Sultangazi", Neighborhood, "059")));

        Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission? captured = null;
        _submissions.Setup(x => x.AddAsync(It.IsAny<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission>(), It.IsAny<CancellationToken>()))
            .Callback<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        var req = BaseRequest(citizenPhone: "05551234567");
        await _service.CreateByMuhtarAsync(req, CancellationToken.None);

        Assert.NotNull(captured);
        Assert.Equal("Mehmet Kaya", captured!.CitizenName);
        Assert.Equal("05551234567", captured.CitizenPhone);
        Assert.Equal("NVI Adres Sk. No:1", captured.Address);
    }

    [Fact]
    public async Task CreateByMuhtarAsync_NVI_basarisizsa_ConflictException_firlatir()
    {
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(ValidTckn, It.IsAny<DateTime>(), 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(false, "Kimlik doğrulanamadı.", null, []));

        var req = BaseRequest(citizenPhone: "05551234567");
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.CreateByMuhtarAsync(req, CancellationToken.None));
        Assert.Equal("NVI_FAILED", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateByMuhtarAsync_gecersiz_tc_ConflictException_firlatir()
    {
        var req = BaseRequest() with { CitizenTc = "00000000000" };
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.CreateByMuhtarAsync(req, CancellationToken.None));
        Assert.Equal("INVALID_TCKN", ex.ErrorCode);
    }

    [Fact]
    public async Task CreateByMuhtarAsync_farkli_adres_secilirse_girilen_adres_kullanilir()
    {
        var participant = MakeParticipant(ValidTckn, "Ayşe Yılmaz", "05551112233", "Kayıtlı Adres");
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission? captured = null;
        _submissions.Setup(x => x.AddAsync(It.IsAny<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission>(), It.IsAny<CancellationToken>()))
            .Callback<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmission, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        var req = BaseRequest(addressType: "other", address: "Başka Mahalle, Farklı Sokak No:9");
        await _service.CreateByMuhtarAsync(req, CancellationToken.None);

        Assert.Equal("Başka Mahalle, Farklı Sokak No:9", captured!.Address);
        Assert.Equal("other", captured.AddressType);
    }

    [Fact]
    public async Task MuhtarNviLookupAsync_kayitli_vatandas_icin_maskeli_telefon_doner()
    {
        var participant = MakeParticipant(ValidTckn, "Ayşe Yılmaz", "05551112233", "Kayıtlı Adres");
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync(participant);

        var result = await _service.MuhtarNviLookupAsync(new MuhtarNviLookupRequest(ValidTckn, new DateTime(1990, 5, 1)), CancellationToken.None);

        Assert.True(result.IsRegisteredCitizen);
        Assert.Equal("Ayşe Yılmaz", result.FullName);
        Assert.NotNull(result.RegisteredPhoneMasked);
        Assert.DoesNotContain("05551112233", result.RegisteredPhoneMasked);
        _nvi.Verify(x => x.GetPersonAndChildrenAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MuhtarNviLookupAsync_kayitsiz_vatandas_icin_NVIden_gelir()
    {
        _uow.Setup(x => x.Participants.GetByTcknAsync(ValidTckn, It.IsAny<CancellationToken>())).ReturnsAsync((Participant?)null);
        _nvi.Setup(x => x.GetPersonAndChildrenAsync(ValidTckn, It.IsAny<DateTime>(), 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new NviPersonAndChildrenResponse(true, null, new NviPersonDto(ValidTckn, "Mehmet", "Kaya", new DateTime(1990, 5, 1), Gender.Male, "Adres"), []));

        var result = await _service.MuhtarNviLookupAsync(new MuhtarNviLookupRequest(ValidTckn, new DateTime(1990, 5, 1)), CancellationToken.None);

        Assert.False(result.IsRegisteredCitizen);
        Assert.Equal("Mehmet Kaya", result.FullName);
        Assert.Null(result.RegisteredPhoneMasked);
    }

    [Fact]
    public async Task MuhtarNviLookupAsync_coklu_mahalle_scope_reddedilir()
    {
        _scopeService.Setup(x => x.GetScopedNamesAsync(AdminUserId, "muhtarlik", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string> { Neighborhood, "Gazi Mahallesi" });

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.MuhtarNviLookupAsync(new MuhtarNviLookupRequest(ValidTckn, new DateTime(1990, 5, 1)), CancellationToken.None));
        Assert.Equal("MUHTAR_SCOPE_REQUIRED", ex.ErrorCode);
    }
}
