using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class EventApplicationCapacityTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IActivityLogger> _log = new();
    private readonly Mock<IExcelService> _excel = new();
    private readonly Mock<IEventNotificationService> _notifications = new();
    private readonly Mock<Nexora.Application.Features.Notifications.INotificationService> _inApp = new();
    private readonly Mock<IOptionsMonitor<ResidencySettings>> _residency = new();
    private readonly Mock<IDashboardRealtimeNotifier> _dashboard = new();
    private readonly Mock<IEventSettingsService> _eventSettings = new();
    private readonly Mock<IUserScopeService> _scope = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IEventApplicationRepository> _applications = new();
    private readonly Mock<IEventRepository> _events = new();
    private readonly Mock<ISessionRepository> _sessions = new();
    private readonly Mock<IParticipantRepository> _participants = new();
    private readonly Mock<IEventCategoryRepository> _categories = new();
    private readonly EventApplicationService _service;

    private static readonly Guid EventId = Guid.NewGuid();
    private static readonly Guid ApplicationId = Guid.NewGuid();

    public EventApplicationCapacityTests()
    {
        _uow.SetupGet(x => x.EventApplications).Returns(_applications.Object);
        _uow.SetupGet(x => x.Events).Returns(_events.Object);
        _uow.SetupGet(x => x.Sessions).Returns(_sessions.Object);
        _uow.SetupGet(x => x.Participants).Returns(_participants.Object);
        _uow.SetupGet(x => x.EventCategories).Returns(_categories.Object);
        _categories.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<EventCategory, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        _currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        _scope.Setup(x => x.GetScopedRefIdsAsync(It.IsAny<Guid>(), "events", It.IsAny<CancellationToken>()))
            .ReturnsAsync((HashSet<Guid>?)null);
        _residency.SetupGet(x => x.CurrentValue).Returns(new ResidencySettings());

        _service = new EventApplicationService(
            _uow.Object, _currentUser.Object, _log.Object, _excel.Object, _notifications.Object,
            _inApp.Object, _residency.Object, _dashboard.Object, _eventSettings.Object,
            _scope.Object, _audit.Object);
    }

    private static Event BuildEvent(int capacity)
    {
        var ev = Event.Create(
            new EventData("Test Etkinlik", Guid.NewGuid(), "indoor", null, null, null,
                DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(5), true, "mixed", capacity, 0,
                0, 0, "none", 0, "", "", "{}", "{}", "{}", "{}", true, false, "10:00", "12:00", "anyone"),
            "EVT-000001", "Tester");
        typeof(Event).GetProperty("Id")!.SetValue(ev, EventId);
        return ev;
    }

    private static EventApplication BuildApplication(string status)
    {
        var app = EventApplication.Create(EventId, null, Guid.NewGuid(), DateTime.UtcNow.Date,
            status, "none", "free", "BSV-000001", "Tester");
        typeof(EventApplication).GetProperty("Id")!.SetValue(app, ApplicationId);
        return app;
    }

    [Fact]
    public async Task SetStatusAsync_bekleyen_basvurular_kontenjani_doldurmussa_onaylamaz()
    {
        // 2026-08-14 kendi-denetimimde bulundu: bu test bayat bir varsayıma dayanıyordu
        // ("approved+pending kontenjanı doldurursa onaylanamaz"). Gerçek kullanıcı
        // 2026-08-05'te KRİTİK bir kapasite hesap hatasını düzeltmişti (bkz.
        // EventApplicationService.cs yorumu): eskiden pending başvurular da kontenjanı
        // işgal ediyormuş gibi sayılıyordu, bu yüzden kontenjan=1 iken 3 kişi pending
        // olduğunda İLK onay bile reddediliyordu (canlı doğrulanmış bug). Düzeltme
        // sonrası yalnızca GERÇEKTEN onaylanmış (approved) sayısı kontenjanı işgal
        // eder. Test artık approved sayısının kontenjanı doldurduğu (pending değil)
        // gerçek senaryoyu doğruluyor.
        var ev = BuildEvent(capacity: 10);
        var app = BuildApplication("waitlist");

        _applications.Setup(x => x.GetByIdAsync(ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(app);
        _events.Setup(x => x.GetByIdAsync(EventId, It.IsAny<CancellationToken>())).ReturnsAsync(ev);
        _applications.Setup(x => x.CountByScopeAsync(EventId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Approved: 10, Pending: 6, Waitlist: 3));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.SetStatusAsync(ApplicationId, "approved", null, CancellationToken.None));

        Assert.Equal("CAPACITY_FULL", ex.ErrorCode);
    }

    [Fact]
    public async Task SetStatusAsync_kapasite_kontrolu_advisory_lock_altinda_yapilir()
    {
        var ev = BuildEvent(capacity: 10);
        var app = BuildApplication("waitlist");

        _applications.Setup(x => x.GetByIdAsync(ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(app);
        _events.Setup(x => x.GetByIdAsync(EventId, It.IsAny<CancellationToken>())).ReturnsAsync(ev);
        _applications.Setup(x => x.CountByScopeAsync(EventId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Approved: 10, Pending: 6, Waitlist: 3));

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.SetStatusAsync(ApplicationId, "approved", null, CancellationToken.None));

        _uow.Verify(x => x.AcquireAdvisoryLockAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Once);
        _uow.Verify(x => x.RollbackAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetStatusAsync_bekleyen_basvuru_kendisini_kontenjandan_dusurur()
    {
        // 2026-08-14 kendi-denetimimde bulundu: 2026-08-05'te eklenen
        // CloseOverflowPendingAsync özelliği (aşırı-dolu bekleyen başvuruları otomatik
        // reddetme), bir başvuru onaylandığında/yedeğe alındığında AYRICA kendi
        // BeginTransactionAsync/CommitAsync çiftini açıyor — bu meşru, bağımsız bir
        // ikinci iş birimi (ana onay transaction'ından SONRA, ayrı bir transaction'da
        // çalışır). Bu yüzden CommitAsync artık 1 değil 2 kez çağrılır. Test bunu
        // yansıtacak şekilde güncellendi.
        var ev = BuildEvent(capacity: 10);
        var app = BuildApplication("pending");

        _applications.Setup(x => x.GetByIdAsync(ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(app);
        _events.Setup(x => x.GetByIdAsync(EventId, It.IsAny<CancellationToken>())).ReturnsAsync(ev);
        _applications.Setup(x => x.CountByScopeAsync(EventId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Approved: 4, Pending: 6, Waitlist: 0));
        // SetStatusAsync başarılı onay sonrası MapManyAsync ile DTO'ya dönüştürür —
        // bu, Events/Participants repository'lerinde FindAsync (temel IRepository
        // metodu) çağırır; mock'lanmazsa null döner ve ToDictionary NullReferenceException
        // yerine ArgumentNullException fırlatır (kaydedilmemiş kısıt, gerçek bir bug
        // değil — yalnızca bu testte eksik mock kurulumu).
        _events.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Event, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([ev]);
        _participants.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Nexora.Domain.Entities.Participants.Participant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        _participants.Setup(x => x.FindIncludingDeletedAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Nexora.Domain.Entities.Participants.Participant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var ex = await Record.ExceptionAsync(() => _service.SetStatusAsync(ApplicationId, "approved", null, CancellationToken.None));

        Assert.Null(ex);
        Assert.Equal("approved", app.Status);
        _uow.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Exactly(2));
        _uow.Verify(x => x.RollbackAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_reddedilmis_basvuruyu_dogrudan_onaylayamaz()
    {
        var ev = BuildEvent(capacity: 10);
        var app = BuildApplication("rejected");

        _applications.Setup(x => x.GetByIdAsync(ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(app);
        _events.Setup(x => x.GetByIdAsync(EventId, It.IsAny<CancellationToken>())).ReturnsAsync(ev);

        var req = new ApplicationFormRequest(Guid.NewGuid(), EventId, null, "approved", "none", "free", null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.UpdateAsync(ApplicationId, req, CancellationToken.None));

        Assert.Equal("INVALID_STATUS_TRANSITION", ex.ErrorCode);
    }

    [Fact]
    public async Task UpdateAsync_gecersiz_durum_degerini_reddeder()
    {
        var ev = BuildEvent(capacity: 10);
        var app = BuildApplication("pending");

        _applications.Setup(x => x.GetByIdAsync(ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(app);
        _events.Setup(x => x.GetByIdAsync(EventId, It.IsAny<CancellationToken>())).ReturnsAsync(ev);

        var req = new ApplicationFormRequest(Guid.NewGuid(), EventId, null, "onaylandi", "none", "free", null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.UpdateAsync(ApplicationId, req, CancellationToken.None));

        Assert.Equal("INVALID_APPLICATION_STATUS", ex.ErrorCode);
    }
}
