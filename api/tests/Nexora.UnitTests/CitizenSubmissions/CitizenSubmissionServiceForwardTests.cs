using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Nvi;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.CitizenSubmissions;

// ULAK-02/03: dış iletim sonucu belirsizse (Unknown) durum KALICI işaretlenir ve ikinci "İlet" çağrısı
// yeni bir dış HTTP çağrısı YAPMADAN engellenir. Kesin başarısızlık (Failed) durumunda ise yeniden
// gönderime izin verilir (durum işaretlenmez).
public class CitizenSubmissionServiceForwardTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICitizenSubmissionRepository> _submissions = new();
    private readonly Mock<IScopeNodeRepository> _scopeNodes = new();
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
    private readonly Mock<IRedisService> _redis = new();
    private readonly CitizenSubmissionService _service;

    public CitizenSubmissionServiceForwardTests()
    {
        _current.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        _scopeService.Setup(x => x.GetScopedNamesAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((HashSet<string>?)null);
        _uow.Setup(u => u.CitizenSubmissions).Returns(_submissions.Object);
        _uow.Setup(u => u.ScopeNodes).Returns(_scopeNodes.Object);
        _uow.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _redis.Setup(r => r.TryAcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("lock-token");

        _service = BuildService(new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build());
    }

    private CitizenSubmissionService BuildService(Microsoft.Extensions.Configuration.IConfiguration config) =>
        new(_uow.Object, _audit.Object, _current.Object, _scopeService.Object,
            _scopedStaff.Object, _ulakbelForward.Object, _integrationSettings.Object,
            _notificationService.Object, _dispatcher.Object, _moduleSettings.Object,
            _contentAnalyzer.Object, _nvi.Object, _fileStorage.Object, _sms.Object, _smsGovernance.Object,
            _redis.Object, config,
            Microsoft.Extensions.Logging.Abstractions.NullLogger<CitizenSubmissionService>.Instance);

    private CitizenSubmission NewSubmission()
    {
        var s = CitizenSubmission.Create(
            "Ali Veli", "5551112233", "12345678901", "Cumhuriyet Mahallesi", "adres",
            "genel", "request", "normal", "Kaldırım bozuk", "Açıklama");
        _submissions.Setup(r => r.GetByIdAsync(s.Id, It.IsAny<CancellationToken>())).ReturnsAsync(s);
        _submissions.Setup(r => r.GetByIdFreshAsync(s.Id, It.IsAny<CancellationToken>())).ReturnsAsync(s);
        // Fenced repo yazımları (gerçek DB'de atomik koşullu UPDATE — burada tracked entity'yi aynen
        // yansıtan callback'lerle taklit edilir; gerçek kalıcılık/fencing entegrasyon testlerinde).
        _submissions.Setup(r => r.TryBeginForwardAttemptAsync(s.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.NewGuid());
        _submissions.Setup(r => r.TryApplyForwardUnknownAsync(s.Id, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback(() => s.MarkForwardOutcomeUnknown()).ReturnsAsync(true);
        _submissions.Setup(r => r.TryClearForwardSendingAsync(s.Id, It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Callback(() => s.ResetUlakbelForwardState()).ReturnsAsync(true);
        _submissions.Setup(r => r.TryApplyForwardDeliveredAsync(s.Id, It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback(() => s.RecordUlakbelForward("Fen İşleri", "REMOTE")).ReturnsAsync(true);
        _submissions.Setup(r => r.TryResetForwardStateAsync(s.Id, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .Callback(() => s.ResetUlakbelForwardState()).ReturnsAsync(true);
        return s;
    }

    private void SetupForwardOutcome(UlakbelForwardOutcome outcome) =>
        _ulakbelForward.Setup(f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UlakbelForwardResult(false, "", false, "belirsiz", outcome));

    [Fact]
    public async Task ForwardAsync_belirsiz_sonuc_kalici_isaretlenir_ikinci_cagri_yeni_HTTP_atmaz()
    {
        var s = NewSubmission();
        SetupForwardOutcome(UlakbelForwardOutcome.Unknown);

        await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));
        Assert.True(s.HasUnknownForwardOutcome);

        await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));

        _ulakbelForward.Verify(
            f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ForwardAsync_kesin_basarisizlik_durumu_isaretlemez_yeniden_denenebilir()
    {
        var s = NewSubmission();
        SetupForwardOutcome(UlakbelForwardOutcome.Failed);

        await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));
        Assert.False(s.HasUnknownForwardOutcome);

        await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));

        _ulakbelForward.Verify(
            f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    // ULAK-03 (E): yenileme sırasında Redis hatası → renewal task faulted olmamalı, ana teslim sonucunu
    // ÖRTMEMELİ ve kilit bırakma adımını ATLATMAMALI.
    [Fact]
    public async Task ForwardAsync_renewal_hatasi_ana_sonucu_ortmez_ve_release_dener()
    {
        var s = NewSubmission();
        _integrationSettings.Setup(x => x.ShouldNotifyCitizenOnUlakbelUpdateAsync(It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _scopeNodes.Setup(r => r.GetByRefAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Authority.ScopeNode?)null);
        var participants = new Mock<IParticipantRepository>();
        participants.Setup(p => p.GetByTcknAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Participants.Participant?)null);
        _uow.Setup(u => u.Participants).Returns(participants.Object);
        _uow.Setup(u => u.AdminUsers.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Auth.AdminUser?)null);
        _uow.Setup(u => u.CitizenSubmissionEvents.AddAsync(It.IsAny<Nexora.Domain.Entities.CitizenSubmissions.CitizenSubmissionEvent>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Etkin TTL 10 sn → yenileme aralığı 3 sn. Gönderim ~4 sn sürer; yenileme fırlatır.
        _redis.Setup(r => r.RenewLockAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("redis down"));
        _redis.Setup(r => r.ReleaseLockAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _ulakbelForward.Setup(f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()))
            .Returns(async () => { await Task.Delay(TimeSpan.FromSeconds(4)); return new UlakbelForwardResult(false, "REMOTE-E", true, null, UlakbelForwardOutcome.Delivered); });

        var service = BuildService(new Microsoft.Extensions.Configuration.ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["CitizenSubmissionSettings:ForwardLockTtlSeconds"] = "10" })
            .Build());

        var dto = await service.ForwardAsync(s.Id, CancellationToken.None);

        Assert.NotNull(dto);
        // Yenileme yolu gerçekten çalıştı (exception attı) ama ana sonucu örtmedi ve release atlanmadı.
        _redis.Verify(r => r.RenewLockAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        _redis.Verify(r => r.ReleaseLockAsync(It.IsAny<string>(), "lock-token", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ForwardAsync_teslim_sonuc_yazilamazsa_OUTCOME_UNKNOWN_atar()
    {
        var s = NewSubmission();
        SetupForwardOutcome(UlakbelForwardOutcome.Delivered);
        _ulakbelForward.Setup(f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UlakbelForwardResult(false, "REMOTE-X", true, null, UlakbelForwardOutcome.Delivered));
        _submissions.Setup(r => r.TryApplyForwardDeliveredAsync(s.Id, It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));
        Assert.Equal("ULAKBEL_OUTCOME_UNKNOWN", ex.ErrorCode);
    }

    [Fact]
    public async Task ForwardAsync_kilit_alinamazsa_dis_servis_cagrilmadan_reddeder()
    {
        var s = NewSubmission();
        SetupForwardOutcome(UlakbelForwardOutcome.Delivered);
        _redis.Setup(r => r.TryAcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));
        Assert.Equal("ULAKBEL_FORWARD_IN_PROGRESS", ex.ErrorCode);

        _ulakbelForward.Verify(
            f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ResetUlakbelForwardStateAsync_gerekce_bos_ise_reddeder()
    {
        var s = NewSubmission();
        var ex = await Assert.ThrowsAsync<ConflictException>(
            () => _service.ResetUlakbelForwardStateAsync(s.Id, "   ", CancellationToken.None));
        Assert.Equal("RESET_REASON_REQUIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task ResetUlakbelForwardStateAsync_belirsiz_kilidi_kaldirir_yeniden_gonderime_izin_verir()
    {
        var s = NewSubmission();
        _scopeNodes.Setup(r => r.GetByRefAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Nexora.Domain.Entities.Authority.ScopeNode?)null);
        SetupForwardOutcome(UlakbelForwardOutcome.Unknown);

        await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));
        Assert.True(s.HasUnknownForwardOutcome);

        await _service.ResetUlakbelForwardStateAsync(s.Id, "Ulakbell'de kayıt bulunamadı, doğrulandı.", CancellationToken.None);
        Assert.False(s.HasUnknownForwardOutcome);

        await Assert.ThrowsAsync<ConflictException>(() => _service.ForwardAsync(s.Id, CancellationToken.None));
        _ulakbelForward.Verify(
            f => f.ForwardAsync(It.IsAny<UlakbelForwardRequest>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }
}
