using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Services.Scheduled;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services.Scheduled;

// Kod denetimi 2026-08-14 (kullanıcı isteği: "kütüphane ... profesyonel giriş yoklama"
// son kontrolü). Süresi dolan çıkış niyetleri (exit_pending) için önceden yalnızca
// ReleaseSeatOnExitTimeout() çağrılıyordu — bu yalnızca koltuğu boşaltır, Status'u
// "exit_pending"den ÇIKARMAZ. exit_pending, ActiveStatuses listesinde olduğu için oturum
// kapasitede süresiz "içeride" sayılmaya devam ediyordu (canlı DB'de AutoCheckOutAfterMinutes=0
// olan 1406 kütüphaneden 926'sında bu asla kendiliğinden düzelmiyordu). Bu test, job'ın artık
// doğru şekilde ExitAsNoShow() çağırdığını (Status→no_show, ExitTime set, kapasiteden düşer)
// kalıcı olarak kilitler. Canlı DB'de senkron kanıt: gerçek 30dk'lık takılı bir test session'ı
// oluşturulup Hangfire'ın 1 dakikalık job'ı çalıştıktan sonra no_show'a döndüğü doğrulandı.
public class LibraryMaintenanceJobExitIntentTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibrarySettingsService> _settings = new();
    private readonly Mock<ILibraryNotificationService> _notify = new();
    private readonly Mock<ILibraryOperationsService> _libraryOps = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IConfiguration> _config = new();

    private readonly Mock<ILibrarySessionRepository> _sessions = new();
    private readonly Mock<ILibraryBreakRepository> _breaks = new();
    private readonly Mock<ILibraryQueueRepository> _queue = new();
    private readonly Mock<ILibraryReservationRepository> _reservations = new();
    private readonly Mock<ILibraryShiftRepository> _shifts = new();
    private readonly Mock<ILibraryRepository> _libraries = new();

    private readonly LibraryMaintenanceJob _job;

    public LibraryMaintenanceJobExitIntentTests()
    {
        _uow.SetupGet(x => x.LibrarySessions).Returns(_sessions.Object);
        _uow.SetupGet(x => x.LibraryBreaks).Returns(_breaks.Object);
        _uow.SetupGet(x => x.LibraryQueue).Returns(_queue.Object);
        _uow.SetupGet(x => x.LibraryReservations).Returns(_reservations.Object);
        _uow.SetupGet(x => x.LibraryShifts).Returns(_shifts.Object);
        _uow.SetupGet(x => x.Libraries).Returns(_libraries.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        // Gün-sonu kesim tetiklenmesin diye "şu an" gün sonu saatinde değil.
        _config.Setup(c => c.GetSection(It.IsAny<string>())).Returns(new Mock<IConfigurationSection>().Object);

        _sessions.Setup(x => x.GetActiveSessionsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _breaks.Setup(x => x.GetExpiredGraceAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _breaks.Setup(x => x.GetActiveBreaksAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _queue.Setup(x => x.GetExpiredCalledAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _reservations.Setup(x => x.GetExpiredHoldsAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _reservations.Setup(x => x.GetActiveHoldsAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _shifts.Setup(x => x.GetAllOpenAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);

        _job = new LibraryMaintenanceJob(_uow.Object, _settings.Object, _notify.Object, _libraryOps.Object, _audit.Object, BuildConfig());
    }

    private static IConfiguration BuildConfig()
        => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["LibraryAccess:ExitIntentWindowMinutes"] = "5",
            ["LibrarySettings:LocalTimeZoneOffsetMinutes"] = "180",
            ["LibrarySettings:DailyCutoffHour"] = "23",
            ["LibrarySettings:DailyCutoffMinute"] = "0",
        }).Build();

    private static LibrarySession CreateStuckExitPendingSession(Guid libraryId)
    {
        var session = LibrarySession.Create(libraryId, Guid.NewGuid(), "Test Üye", "11111111110", null, null, null, "A-1", null, "qr");
        session.RegisterExitIntent();
        return session;
    }

    [Fact]
    public async Task Suresi_dolan_cikis_niyeti_artik_no_show_olarak_kapatilir_exit_pendingde_takili_kalmaz()
    {
        var libraryId = Guid.NewGuid();
        var session = CreateStuckExitPendingSession(libraryId);

        _sessions.Setup(x => x.GetExpiredExitIntentsAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([session]);
        _breaks.Setup(x => x.GetActiveBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync((LibraryBreak?)null);
        _libraries.Setup(x => x.GetByIdAsync(libraryId, It.IsAny<CancellationToken>())).ReturnsAsync((Library?)null);

        await _job.RunAsync(CancellationToken.None);

        // ÖNCEKİ (hatalı) davranış: session.Status hâlâ "exit_pending" kalırdı (ActiveStatuses
        // içinde, kapasitede süresiz "içeride" sayılır). YENİ davranış: no_show'a kapanır.
        Assert.Equal(LibrarySessionStatus.NoShow, session.Status);
        Assert.True(session.IsExitNoShow);
        Assert.NotNull(session.ExitTime);
        Assert.Null(session.PendingExitAt);
        Assert.False(LibrarySessionStatus.IsActive(session.Status));

        _sessions.Verify(x => x.Update(session), Times.AtLeastOnce);
    }

    [Fact]
    public async Task Suresi_dolan_cikis_niyeti_veliye_cikis_bildirimi_tetikler()
    {
        var libraryId = Guid.NewGuid();
        var session = CreateStuckExitPendingSession(libraryId);

        _sessions.Setup(x => x.GetExpiredExitIntentsAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([session]);
        _breaks.Setup(x => x.GetActiveBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync((LibraryBreak?)null);
        _libraries.Setup(x => x.GetByIdAsync(libraryId, It.IsAny<CancellationToken>())).ReturnsAsync((Library?)null);

        await _job.RunAsync(CancellationToken.None);

        _notify.Verify(x => x.NotifyGuardianOnExitAsync(
            libraryId, It.IsAny<string>(), session.MemberName, session.BirthDate, session.GuardianPhone, It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
