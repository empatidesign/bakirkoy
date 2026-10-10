using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Notifications;
using Nexora.Domain.Entities.CitizenSubmissions;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services.Scheduled;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services.Scheduled;

/// <summary>
/// Kullanıcı isteği (2026-09-07): "Ulakbel'e iletilen taleplerin süresi dolmak üzereyken
/// veya aşıldığında vatandaşa push bildirim gönderilsin". Bu testler, SLA eşiklerinin
/// (uyarı %80, aşım %100 — bkz. MuhtarlikReference.SlaTargetsFor) doğru tetiklendiğini
/// ve idempotency alanları (SlaWarningNotifiedAt/SlaBreachNotifiedAt) sayesinde AYNI eşik
/// için bildirimin İKİNCİ KEZ gönderilmediğini kilit altına alır.
/// </summary>
public class CitizenSubmissionStatusCheckJobTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IConfiguration> _config = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<INotificationService> _notification = new();
    private readonly Mock<ICitizenSubmissionRepository> _submissions = new();
    private readonly Mock<IParticipantRepository> _participants = new();

    private readonly CitizenSubmissionStatusCheckJob _job;
    private readonly List<CitizenSubmission> _all = [];

    public CitizenSubmissionStatusCheckJobTests()
    {
        _uow.SetupGet(x => x.CitizenSubmissions).Returns(_submissions.Object);
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _config.Setup(c => c.GetSection(It.IsAny<string>())).Returns(new Mock<IConfigurationSection>().Object);

        // ULAK-03 (A): job artık SLA işaretini dar ExecuteUpdate repo metoduyla yazar (tam-satır Update yok).
        // Mock, gerçek DB davranışını yansıtacak şekilde ilgili entity'yi işaretler (assertion'lar için).
        _submissions.Setup(r => r.MarkSlaBreachNotifiedAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns((Guid id, CancellationToken _) => { _all.FirstOrDefault(x => x.Id == id)?.MarkSlaBreachNotified(); return Task.CompletedTask; });
        _submissions.Setup(r => r.MarkSlaWarningNotifiedAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns((Guid id, CancellationToken _) => { _all.FirstOrDefault(x => x.Id == id)?.MarkSlaWarningNotified(); return Task.CompletedTask; });

        _job = new CitizenSubmissionStatusCheckJob(
            _uow.Object, _config.Object, _audit.Object, _notification.Object,
            Mock.Of<ILogger<CitizenSubmissionStatusCheckJob>>());
    }

    private static Participant MakeParticipant(string tckn) => Participant.Create(
        tckn, "Test Vatandaş", DateTime.UtcNow.AddYears(-30), Gender.Male, false,
        "hash", null, "5551234567", null, null, "Adres");

    private CitizenSubmission MakeSubmission(string tckn, string priority, double hoursAgo, string status = "in_review")
    {
        var s = CitizenSubmission.Create(
            "Vatandaş", "5551234567", tckn, "Cebeci", "Adres",
            "roads", "complaint", priority, "Yol bozuk", "Açıklama");
        s.SetStatus(status);
        typeof(CitizenSubmission).GetProperty("SubmittedAt")!
            .SetValue(s, DateTime.UtcNow.AddHours(-hoursAgo));
        _all.Add(s);
        return s;
    }

    [Fact]
    public async Task RunAsync_SlaAsimi_gecen_kayit_icin_asim_bildirimi_gonderir_ve_isaretler()
    {
        // "normal" öncelik: ResolutionHours=240. 250 saat geçmiş → aşım.
        var s = MakeSubmission("11111111111", "normal", hoursAgo: 250);
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([s]);
        _participants.Setup(x => x.GetByTcknAsync("11111111111", It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeParticipant("11111111111"));

        await _job.RunAsync(CancellationToken.None);

        _notification.Verify(x => x.CreateAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.Is<string>(b => b.Contains("aşıldı")),
            "submission", "citizen-submission", s.Id.ToString(), null, null, "sla_breach", It.IsAny<CancellationToken>()),
            Times.Once);
        Assert.NotNull(s.SlaBreachNotifiedAt);
        Assert.Null(s.SlaWarningNotifiedAt);
    }

    [Fact]
    public async Task RunAsync_SlaUyari_esigine_ulasan_kayit_icin_uyari_bildirimi_gonderir()
    {
        // "normal" öncelik: ResolutionHours=240, uyarı eşiği=192 saat (%80). 200 saat geçmiş → uyarı (henüz aşım değil).
        var s = MakeSubmission("22222222222", "normal", hoursAgo: 200);
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([s]);
        _participants.Setup(x => x.GetByTcknAsync("22222222222", It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeParticipant("22222222222"));

        await _job.RunAsync(CancellationToken.None);

        _notification.Verify(x => x.CreateAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.Is<string>(b => b.Contains("yaklaşıyor") == false && b.Contains("hedef çözüm süresi")),
            "submission", "citizen-submission", s.Id.ToString(), null, null, "sla_warning", It.IsAny<CancellationToken>()),
            Times.Once);
        Assert.NotNull(s.SlaWarningNotifiedAt);
        Assert.Null(s.SlaBreachNotifiedAt);
    }

    [Fact]
    public async Task RunAsync_esik_altindaki_kayit_icin_bildirim_gondermez()
    {
        // 50 saat, hedefin (240) çok altında.
        var s = MakeSubmission("33333333333", "normal", hoursAgo: 50);
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([s]);

        await _job.RunAsync(CancellationToken.None);

        _notification.Verify(x => x.CreateAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _participants.Verify(x => x.GetByTcknAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RunAsync_daha_once_asim_bildirimi_gonderilmis_kayit_icin_tekrar_gondermez()
    {
        // İdempotency: SlaBreachNotifiedAt zaten dolu ise, aynı kayıt için ikinci kez tetiklenmemeli.
        var s = MakeSubmission("44444444444", "normal", hoursAgo: 300);
        s.MarkSlaBreachNotified();
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([s]);

        await _job.RunAsync(CancellationToken.None);

        _notification.Verify(x => x.CreateAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RunAsync_katilimci_kaydi_bulunamayan_TC_icin_hata_vermeden_atlar()
    {
        var s = MakeSubmission("55555555555", "normal", hoursAgo: 250);
        _submissions.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<CitizenSubmission, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([s]);
        _participants.Setup(x => x.GetByTcknAsync("55555555555", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Participant?)null);

        var ex = await Record.ExceptionAsync(() => _job.RunAsync(CancellationToken.None));

        Assert.Null(ex);
        _notification.Verify(x => x.CreateAsync(
            It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        // Participant bulunamadığı için işaretlenmemeli — bir sonraki koşuda tekrar denenebilsin.
        Assert.Null(s.SlaBreachNotifiedAt);
    }
}
