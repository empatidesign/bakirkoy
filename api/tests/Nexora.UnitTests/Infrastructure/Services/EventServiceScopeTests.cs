using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Domain.Entities.Events;
using Nexora.Infrastructure.Services;
using Nexora.Infrastructure.Storage;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Regresyon koruması: EventService'te GetPagedAsync dışındaki tek-kayıt uç noktalarının
// (GetById, Update, Delete, ...) da tesis-bazlı scope kontrolüne tabi olduğunu kanıtlar.
// Düzeltmeden önce yalnızca liste filtreliydi; ID bilen bir kullanıcı GetById ile scope dışı
// bir etkinliğe doğrudan erişebiliyordu (bkz. programci_salon.md 3.2.2).
public class EventServiceScopeTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IServiceProvider> _serviceProvider = new();
    private readonly Mock<IOptionsMonitor<MinioSettings>> _minioOptions = new();
    private readonly Mock<IActivityLogger> _log = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IParticipantNotificationService> _participantNotify = new();
    private readonly Mock<IUserScopeService> _scopeService = new();
    private readonly Mock<IEventRepository> _events = new();
    private readonly Mock<IEventCategoryRepository> _categories = new();
    private readonly Mock<IEventApplicationRepository> _applications = new();
    private readonly EventService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();
    private static readonly Guid OwnEventId = Guid.NewGuid();
    private static readonly Guid OtherEventId = Guid.NewGuid();

    public EventServiceScopeTests()
    {
        _uow.SetupGet(x => x.Events).Returns(_events.Object);
        _uow.SetupGet(x => x.EventCategories).Returns(_categories.Object);
        _uow.SetupGet(x => x.EventApplications).Returns(_applications.Object);
        _applications.Setup(x => x.CountByEventsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, (int Approved, int Pending, int Waitlist)>());
        _currentUser.SetupGet(x => x.Id).Returns(AdminUserId);
        _scopeService.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "events", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<Guid> { OwnEventId });

        _service = new EventService(
            _uow.Object, _currentUser.Object, _serviceProvider.Object, _minioOptions.Object,
            _log.Object, _audit.Object, _participantNotify.Object, _scopeService.Object, Mock.Of<Nexora.Application.Features.Admin.IScopedStaffService>());
    }

    [Fact]
    public async Task GetByIdAsync_baska_etkinlige_scope_disi_erisim_NotFound_firlatir()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetByIdAsync(OtherEventId, CancellationToken.None));

        _events.Verify(x => x.GetByIdAsync(OtherEventId, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetByIdAsync_kendi_etkinligine_erisim_izin_verir()
    {
        var ev = Event.Create(
            new EventData("Test", Guid.NewGuid(), "indoor", null, null, null,
                DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1), true, "mixed", 10, 0,
                0, 0, "none", 0, "", "", "{}", "{}", "{}", "{}", false, false, "10:00", "12:00", "anyone"),
            "EVT-000001", "Tester");
        typeof(Event).GetProperty("Id")!.SetValue(ev, OwnEventId);
        _events.Setup(x => x.GetByIdAsync(OwnEventId, It.IsAny<CancellationToken>())).ReturnsAsync(ev);

        var result = await _service.GetByIdAsync(OwnEventId, CancellationToken.None);

        Assert.Equal(OwnEventId, result.Id);
    }
}
