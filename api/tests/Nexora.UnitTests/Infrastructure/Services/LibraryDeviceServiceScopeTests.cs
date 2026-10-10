using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Kod denetimi 2026-08-14 (kullanıcı isteği: "kütüphane cihaz giriş-çıkış sistemleri" son
// kontrolü). LibraryDeviceService hiç scope kontrolü yapmıyordu — scope'lu bir kütüphane
// personeli (library.devices izniyle), ID'sini biliyorsa başka bir kıraathanenin cihazını
// görebiliyor/güncelleyebiliyor/silebiliyor/API anahtarını açığa çıkarabiliyor/kilit testini
// (fiziksel kapı açma) uzaktan tetikleyebiliyordu. Canlı HTTP testiyle kanıtlandı: geri alınmış
// kodla cross-tenant GetByIdAsync + RevealApiKeyAsync 200 döndü ve gerçek API anahtarı sızdı;
// fix sonrası ikisi de 404 LIBRARY_NOT_FOUND döndü. Bu testler o regresyonu kalıcı olarak kilitler.
public class LibraryDeviceServiceScopeTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<ILibraryDeviceRepository> _devices = new();
    private readonly Mock<ILibraryRepository> _libraries = new();
    private readonly Mock<ILibraryLockController> _locks = new();
    private readonly Mock<IRedisService> _redis = new();
    private readonly Mock<IConfiguration> _config = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IOperationTemplateClassifier> _classifier = new();
    private readonly LibraryDeviceService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();
    private static readonly Guid ScopedLibraryId = Guid.NewGuid();
    private static readonly Guid OtherLibraryId = Guid.NewGuid();

    public LibraryDeviceServiceScopeTests()
    {
        _uow.SetupGet(x => x.LibraryDevices).Returns(_devices.Object);
        _uow.SetupGet(x => x.Libraries).Returns(_libraries.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        _currentUser.SetupGet(x => x.Id).Returns(AdminUserId);
        _currentUser.SetupGet(x => x.Name).Returns("Test Admin");
        _userScope.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "library", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<Guid> { ScopedLibraryId });

        _redis.Setup(x => x.GetAsync<DateTime?>(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync((DateTime?)null);

        _service = new LibraryDeviceService(_uow.Object, _currentUser.Object, _userScope.Object, _locks.Object, _redis.Object, _config.Object, _audit.Object, _classifier.Object);
    }

    private static LibraryDevice CreateDevice(Guid libraryId)
        => LibraryDevice.Create(libraryId, new LibraryDeviceData("Test Cihaz", "entry", "DEV1", null, 0, null, null, 0, 0, "online", null, true), "LIB-DEV-TEST", "secret-key", "actor");

    [Fact]
    public async Task GetByIdAsync_scope_disi_kutuphanenin_cihazina_erisim_NotFound_firlatir()
    {
        var device = CreateDevice(OtherLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.GetByIdAsync(device.Id, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task GetByIdAsync_scope_icindeki_cihaza_erisim_izin_verir()
    {
        var device = CreateDevice(ScopedLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);

        var result = await _service.GetByIdAsync(device.Id, CancellationToken.None);
        Assert.Equal(device.Id, result.Id);
    }

    [Fact]
    public async Task RevealApiKeyAsync_scope_disi_cihazda_apikey_sizdirmaz()
    {
        var device = CreateDevice(OtherLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.RevealApiKeyAsync(device.Id, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task GetByLibraryAsync_scope_disi_kutuphane_icin_NotFound_firlatir()
    {
        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.GetByLibraryAsync(OtherLibraryId, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
        _devices.Verify(x => x.GetByLibraryAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_scope_disi_cihazi_guncelleyemez()
    {
        var device = CreateDevice(OtherLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);
        var req = new UpdateLibraryDeviceRequest("Yeni Ad", "entry", "DEV1", null, null, null, null, null, null, "online", null, true, "directional", 5);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.UpdateAsync(device.Id, req, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
        _devices.Verify(x => x.Update(It.IsAny<LibraryDevice>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_scope_disi_cihazi_silemez()
    {
        var device = CreateDevice(OtherLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.DeleteAsync(device.Id, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task TestLockAsync_scope_disi_cihazda_fiziksel_kilidi_tetikleyemez()
    {
        var device = CreateDevice(OtherLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.TestLockAsync(device.Id, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
        _locks.Verify(x => x.TriggerAsync(It.IsAny<LibraryDevice>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MoveToLibraryAsync_hedef_kutuphane_scope_disindaysa_NotFound_firlatir()
    {
        var device = CreateDevice(ScopedLibraryId);
        _devices.Setup(x => x.GetByIdAsync(device.Id, It.IsAny<CancellationToken>())).ReturnsAsync(device);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.MoveToLibraryAsync(device.Id, OtherLibraryId, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
        _devices.Verify(x => x.Update(It.IsAny<LibraryDevice>()), Times.Never);
    }

    [Fact]
    public async Task CreateAsync_scope_disi_kutuphaneye_cihaz_eklenemez()
    {
        var library = Library.Create("Test Kütüphane", Guid.NewGuid());
        typeof(Library).GetProperty(nameof(Library.Id))!.SetValue(library, OtherLibraryId);
        _libraries.Setup(x => x.GetByIdAsync(OtherLibraryId, It.IsAny<CancellationToken>())).ReturnsAsync(library);
        var req = new CreateLibraryDeviceRequest("Yeni Cihaz", "entry", "DEV2", null, null, null, null, null, null, "online", null, true, "directional", 5);

        var ex = await Assert.ThrowsAsync<NotFoundException>(() => _service.CreateAsync(OtherLibraryId, req, CancellationToken.None));
        Assert.Equal("LIBRARY_NOT_FOUND", ex.ErrorCode);
        _devices.Verify(x => x.AddAsync(It.IsAny<LibraryDevice>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
