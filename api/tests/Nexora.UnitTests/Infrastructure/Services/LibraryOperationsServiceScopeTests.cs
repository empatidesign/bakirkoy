using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Regresyon koruması: LibraryOperationsService'e tesise-sınırlı bir kullanıcının başka bir
// kütüphanenin verisine erişemediğini kanıtlayan unit testler. Bu testler olmadan, gelecekteki
// bir refactor EnsureInScopeAsync çağrısını sessizce silebilir/kaydırabilir ve canlı testle
// kanıtlanmış olan tesis-bazlı yetki izolasyonu regresyona uğrayabilir (bkz. programci_salon.md
// 3.2.1 — bu class'ta bulunan gerçek PII sızıntısı + yazma açığı).
public class LibraryOperationsServiceScopeTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ILibrarySettingsService> _settings = new();
    private readonly Mock<ILibraryNotificationService> _notify = new();
    private readonly Mock<IEmanetService> _emanet = new();
    private readonly Mock<ICurrentUser> _current = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<ICitizenIdentityQrService> _cidQr = new();
    private readonly Mock<ILibraryLockController> _locks = new();
    private readonly Mock<ILibrarySessionRealtimeNotifier> _realtime = new();
    private readonly Mock<ITemplateRuleEngine> _templateEngine = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<Microsoft.Extensions.Configuration.IConfiguration> _config = new();
    private readonly Mock<ILibraryQueueRepository> _queue = new();
    private readonly Mock<ILibrarySessionRepository> _sessions = new();
    private readonly Mock<ILibraryRepository> _libraries = new();
    private readonly LibraryOperationsService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();
    private static readonly Guid OwnLibraryId = Guid.NewGuid();
    private static readonly Guid OtherLibraryId = Guid.NewGuid();

    public LibraryOperationsServiceScopeTests()
    {
        _uow.SetupGet(x => x.LibraryQueue).Returns(_queue.Object);
        _uow.SetupGet(x => x.LibrarySessions).Returns(_sessions.Object);
        _uow.SetupGet(x => x.Libraries).Returns(_libraries.Object);
        _current.SetupGet(x => x.Id).Returns(AdminUserId);

        // Kullanıcı yalnızca OwnLibraryId'ye scope'lanmış (Kütüphane Sorumlusu senaryosu).
        _userScope.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "library", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<Guid> { OwnLibraryId });

        _service = new LibraryOperationsService(
            _uow.Object, _settings.Object, _notify.Object, _emanet.Object, _current.Object,
            _audit.Object, _cidQr.Object, _locks.Object, _realtime.Object,
            _templateEngine.Object, _userScope.Object, _config.Object);
    }

    [Fact]
    public async Task GetQueueAsync_baska_kutuphaneye_scope_disi_erisim_NotFound_firlatir()
    {
        var p = new QueueListParams();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetQueueAsync(OtherLibraryId, p, CancellationToken.None));

        // Scope dışı olduğu için repository'ye hiç sorgu atılmamalı — sızıntı veritabanı
        // seviyesinde bile denenmemeli.
        _queue.Verify(x => x.GetPagedAsync(OtherLibraryId, It.IsAny<QueueListParams>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetQueueAsync_kendi_kutuphanesine_erisim_izin_verir()
    {
        var p = new QueueListParams();
        _queue.Setup(x => x.GetPagedAsync(OwnLibraryId, p, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Nexora.Application.Common.ApiResponse.PagedResult<LibraryQueueEntry> { Items = [], Total = 0, Page = 1, Limit = 20 });

        var result = await _service.GetQueueAsync(OwnLibraryId, p, CancellationToken.None);

        Assert.NotNull(result);
        _queue.Verify(x => x.GetPagedAsync(OwnLibraryId, p, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CallNextAsync_baska_kutuphaneye_scope_disi_yazma_denemesi_NotFound_firlatir()
    {
        // KUT-SCOPE-001'in yazma tarafı: call-next başka bir kütüphanenin kuyruğunu
        // manipüle edememeli (canlı testte 204 dönerek gerçek bir kuyruk kaydını bozmuştu).
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.CallNextAsync(OtherLibraryId, CancellationToken.None));

        _queue.Verify(x => x.HasCalledAsync(OtherLibraryId, It.IsAny<CancellationToken>()), Times.Never);
        _queue.Verify(x => x.GetFrontWaitingAsync(OtherLibraryId, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetQueueAsync_unscoped_superadmin_icin_kisitlama_uygulamaz()
    {
        // Süperadmin/kapsamsız kullanıcı için GetScopedRefIdsAsync null döner — hiçbir
        // kısıtlama uygulanmamalı (regresyon: unscoped kullanıcı yanlışlıkla engellenmemeli).
        _userScope.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "library", It.IsAny<CancellationToken>()))
            .ReturnsAsync((HashSet<Guid>?)null);
        var p = new QueueListParams();
        _queue.Setup(x => x.GetPagedAsync(OtherLibraryId, p, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Nexora.Application.Common.ApiResponse.PagedResult<LibraryQueueEntry> { Items = [], Total = 0, Page = 1, Limit = 20 });

        var result = await _service.GetQueueAsync(OtherLibraryId, p, CancellationToken.None);

        Assert.NotNull(result);
    }

    [Fact]
    public async Task CallNextAsync_kapasite_yarisina_karsi_advisory_lock_alir()
    {
        // KUT-CAP-003 regresyon koruması: CallNextAsync sayım (HasCalledAsync) ile yazma
        // (SaveChangesAsync) arasında kilitsizdi — iki personel aynı anda çağırınca kuyruktan
        // iki kişi çağrılabiliyordu. Rezervasyon/walk-in yolundaki advisory lock deseni
        // buraya da uygulandı; bu test kilidin gerçekten alındığını kanıtlar.
        var lib = Library.Create("Test Kıraathane", Guid.NewGuid());
        typeof(Library).GetProperty("Id")!.SetValue(lib, OwnLibraryId);
        _libraries.Setup(x => x.GetByIdAsync(OwnLibraryId, It.IsAny<CancellationToken>())).ReturnsAsync(lib);
        _queue.Setup(x => x.HasCalledAsync(OwnLibraryId, It.IsAny<CancellationToken>())).ReturnsAsync(true);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CallNextAsync(OwnLibraryId, CancellationToken.None));

        _uow.Verify(x => x.AcquireAdvisoryLockAsync(It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Once);
        _uow.Verify(x => x.RollbackAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkEnteredAsync_scope_disi_kuyruk_kaydinda_NotFound_firlatir()
    {
        var entry = LibraryQueueEntry.Create(OtherLibraryId, "Q-001", null, "Test", "11111111111", "5550000000", null, null, "manual");
        _queue.Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync(entry);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.MarkEnteredAsync(Guid.NewGuid(), CancellationToken.None));

        _sessions.Verify(x => x.AddAsync(It.IsAny<LibrarySession>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
