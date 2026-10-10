using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Nvi;
using Nexora.Application.Features.ParticipantAuth;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;
using Nexora.Application.Features.Loyalty;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

/// <summary>
/// Kullanıcı bulgusu (2026-09-23): admin panelde "Katılımcı Düzenle" formu, KVKK maskeleme
/// açıkken (MaskIdentity=true, varsayılan) liste ekranından gelen maskelenmiş telefonu
/// (ör. "532****33") forma dolduruyordu. PhoneInput yıldızları sildiği için bozuk/kısa bir
/// numara kalıyor, admin telefona hiç dokunmadan formu kaydetse bile bu bozuk değer GERÇEK
/// telefon numarasının üzerine yazılıyordu. Bu testler UpdateAsync'in artık boş/maskelenmiş
/// alanları "değişmemiş" sayıp mevcut kaydı koruduğunu doğrular.
/// </summary>
public class ParticipantManagementServiceUpdateTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IParticipantRepository> _participants = new();
    private readonly Mock<INviService> _nvi = new();
    private readonly IConfiguration _config = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["PasswordPolicy:GeneratedLength"] = "12",
            ["SmsSettings:UseMockMode"] = "true",
        })
        .Build();
    private readonly Mock<IOptionsMonitor<ParticipantSettings>> _settings = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IParticipantAuthService> _participantAuth = new();
    private readonly Mock<INotificationDispatcher> _dispatcher = new();
    private readonly Mock<IOtpService> _otp = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<ILoyaltyService> _loyalty = new();
    private readonly Mock<IParticipantEventHistoryService> _eventHistory = new();
    private readonly Mock<IActivityLogger> _log = new();
    private readonly ParticipantManagementService _service;

    public ParticipantManagementServiceUpdateTests()
    {
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _currentUser.SetupGet(x => x.Id).Returns((Guid?)null);
        _audit.Setup(x => x.LogAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _participantAuth.Setup(x => x.TerminateSessionsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _settings.SetupGet(x => x.CurrentValue).Returns(new ParticipantSettings { MaskIdentity = true });
        _otp.Setup(x => x.InvalidateAsync(It.IsAny<Guid>(), It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _service = new ParticipantManagementService(
            _uow.Object, _nvi.Object, _config, _settings.Object, _audit.Object, _participantAuth.Object,
            _otp.Object,
            _dispatcher.Object, _currentUser.Object, _userScope.Object, _loyalty.Object,
            _eventHistory.Object, _log.Object);
    }

    private static Participant MakeParticipant(string phone, string email = "eski@example.com")
    {
        var p = Participant.Create(
            "12345678901", "Test Kisi", new DateTime(1990, 1, 1), Gender.Male, isMinor: false,
            passwordHash: "hash", email: email, phone: phone,
            guardianPhone: null, guardianEmail: null, address: null);
        typeof(Nexora.Domain.Common.BaseEntity).GetProperty("Id")!.SetValue(p, Guid.NewGuid());
        return p;
    }

    [Fact]
    public async Task UpdateAsync_bos_telefon_gonderilirse_mevcut_telefonu_korur()
    {
        var participant = MakeParticipant("05321112233");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _participants.Setup(x => x.CountChildrenForAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.CountGuardiansForAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.CountActivitiesForAsync(It.IsAny<Dictionary<Guid, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _uow.Setup(x => x.EventApplications.CountForParticipantsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());

        // Frontend artık maskelenmiş değeri hiç göndermez (boş bırakır) — bu isteği simüle eder.
        var req = new UpdateParticipantRequest(Phone: null, Email: null, GuardianPhone: null, GuardianEmail: null);

        var result = await _service.UpdateAsync(participant.Id, req, CancellationToken.None);

        Assert.Equal("05321112233", participant.Phone);
        // result.Phone MaskIdentity=true iken görüntüleme amaçlı maskelenir (beklenen davranış) —
        // asıl korunan gerçek değer entity'de (participant.Phone) doğrulanır.
        Assert.NotNull(result);
        _participantAuth.Verify(x => x.TerminateSessionsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_maskelenmis_gorunumlu_telefon_gonderilirse_mevcut_telefonu_korur()
    {
        // Regresyon kilidi: eski PhoneInput davranışı "*" karakterlerini silip rakamlara
        // indirgediği için backend'e "*" hiç ulaşmaz — ama savunma katmanı olarak API'ye
        // DOĞRUDAN maskelenmiş bir değer (ör. başka bir istemci/entegrasyon) gelirse de
        // gerçek numara korunmalı.
        var participant = MakeParticipant("05321112233");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _participants.Setup(x => x.CountChildrenForAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.CountGuardiansForAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.CountActivitiesForAsync(It.IsAny<Dictionary<Guid, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _uow.Setup(x => x.EventApplications.CountForParticipantsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());

        var req = new UpdateParticipantRequest(Phone: "532****33", Email: null, GuardianPhone: null, GuardianEmail: null);

        var result = await _service.UpdateAsync(participant.Id, req, CancellationToken.None);

        Assert.Equal("05321112233", participant.Phone);
    }

    [Fact]
    public async Task UpdateAsync_gercek_yeni_telefon_gonderilirse_gunceller_ve_oturumlari_sonlandirir()
    {
        var participant = MakeParticipant("05321112233");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _participants.Setup(x => x.CountChildrenForAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.CountGuardiansForAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.CountActivitiesForAsync(It.IsAny<Dictionary<Guid, string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _uow.Setup(x => x.EventApplications.CountForParticipantsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());
        _participants.Setup(x => x.GetChildrenAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Participant>());

        var req = new UpdateParticipantRequest(Phone: "05339998877", Email: null, GuardianPhone: null, GuardianEmail: null);

        var result = await _service.UpdateAsync(participant.Id, req, CancellationToken.None);

        Assert.Equal("05339998877", participant.Phone);
        _participantAuth.Verify(x => x.TerminateSessionsAsync(participant.Id, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SendPasswordReset_sms_gonderilemezse_mevcut_sifreyi_korur_ve_oturum_dusurmez()
    {
        var participant = MakeParticipant("05321112233");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _dispatcher.Setup(x => x.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.SendPasswordResetAsync(participant.Id, new SendPasswordResetRequest("Sms"), CancellationToken.None));

        Assert.Equal("CREDENTIAL_DELIVERY_FAILED", ex.ErrorCode);
        Assert.Equal("hash", participant.PasswordHash);
        _participantAuth.Verify(x => x.TerminateSessionsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _otp.Verify(x => x.InvalidateAsync(It.IsAny<Guid>(), It.IsAny<OtpPurpose>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendPasswordReset_sms_basariliysa_gecici_sifreyi_ayarlar_ve_oturum_dusurur()
    {
        var participant = MakeParticipant("05321112233");
        _participants.Setup(x => x.GetByIdAsync(participant.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(participant);
        _dispatcher.Setup(x => x.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        await _service.SendPasswordResetAsync(participant.Id, new SendPasswordResetRequest("Sms"), CancellationToken.None);

        Assert.NotEqual("hash", participant.PasswordHash);
        Assert.True(participant.MustChangePassword);
        _participantAuth.Verify(x => x.TerminateSessionsAsync(participant.Id, It.IsAny<CancellationToken>()), Times.Once);
        _otp.Verify(x => x.InvalidateAsync(participant.Id, OtpPurpose.PasswordReset, It.IsAny<CancellationToken>()), Times.Once);
    }
}
