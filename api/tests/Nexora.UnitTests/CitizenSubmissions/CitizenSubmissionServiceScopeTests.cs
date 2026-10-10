using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Admin;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Nvi;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.CitizenSubmissions;

/// <summary>
/// Denetim düzeltmesi (2026-09-01, KRİTİK): canlı HTTP testinde kanıtlandı — tek bir mahalleye
/// scope'lu bir muhtar hesabı `PUT /api/v1/muhtarlik/notification-settings` ucuna
/// (RequirePermission("muhtarlik.edit") — bu izin scope'lu "muhtar" rol şablonunda VAR) erişip,
/// TÜM 16 mahalledeki vatandaşlara giden SMS/bildirim şablonlarını (tek global kayıt) değiştirebiliyordu.
/// Bu testler `CitizenSubmissionService.EnsureCanManageGlobalNotificationSettingsAsync`'in
/// scope'lu HERHANGİ bir kullanıcıyı reddettiğini, scope'suz (SuperAdmin/belediye yöneticisi)
/// kullanıcıyı ise engellemediğini kanıtlar.
/// </summary>
public class CitizenSubmissionServiceScopeTests
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
    private readonly Mock<IRedisService> _redis = new();
    private readonly CitizenSubmissionService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();

    public CitizenSubmissionServiceScopeTests()
    {
        _current.SetupGet(x => x.Id).Returns(AdminUserId);

        _service = new CitizenSubmissionService(
            _uow.Object, _audit.Object, _current.Object, _scopeService.Object,
            _scopedStaff.Object, _ulakbelForward.Object, _integrationSettings.Object,
            _notificationService.Object, _dispatcher.Object, _moduleSettings.Object,
            _contentAnalyzer.Object, _nvi.Object, _fileStorage.Object, _sms.Object, _smsGovernance.Object,
            _redis.Object, new Microsoft.Extensions.Configuration.ConfigurationBuilder().Build(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<CitizenSubmissionService>.Instance);
    }

    [Fact]
    public async Task EnsureCanManageGlobalNotificationSettingsAsync_tek_mahalleye_scopelu_kullanici_ForbiddenException_firlatir()
    {
        _scopeService.Setup(x => x.GetScopedNamesAsync(AdminUserId, "muhtarlik", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string> { "Cumhuriyet Mahallesi" });

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _service.EnsureCanManageGlobalNotificationSettingsAsync(CancellationToken.None));

        Assert.Equal("GLOBAL_SETTINGS_FORBIDDEN", ex.ErrorCode);
    }

    [Fact]
    public async Task EnsureCanManageGlobalNotificationSettingsAsync_scopesuz_kullanici_hata_firlatmaz()
    {
        // Scope null dönmesi = kısıtsız kullanıcı (SuperAdmin veya scope atanmamış personel).
        _scopeService.Setup(x => x.GetScopedNamesAsync(AdminUserId, "muhtarlik", It.IsAny<CancellationToken>()))
            .ReturnsAsync((HashSet<string>?)null);

        await _service.EnsureCanManageGlobalNotificationSettingsAsync(CancellationToken.None);
        // İstisna atılmadı = başarılı.
    }

    [Fact]
    public async Task EnsureCanManageGlobalNotificationSettingsAsync_bos_scope_seti_de_reddedilir()
    {
        // Boş HashSet (hiçbir mahalleye atanmamış ama scope kaydı var) da "scope'lu" sayılır —
        // yalnızca null (gerçekten kısıtsız) hesap global ayarı değiştirebilmeli.
        _scopeService.Setup(x => x.GetScopedNamesAsync(AdminUserId, "muhtarlik", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<string>());

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _service.EnsureCanManageGlobalNotificationSettingsAsync(CancellationToken.None));

        Assert.Equal("GLOBAL_SETTINGS_FORBIDDEN", ex.ErrorCode);
    }
}
