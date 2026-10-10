using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Domain.Entities.Facilities;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Bkz. spor_salonu_kapsamli_revize_test_gorevi.md madde 1 (Yoklama Sistemi Revizesi) — seans
// başlangıç/bitiş saatinin dışında manuel yoklama alınamamalı, ve grup "Geç Gelme Takibi" kapalıysa
// "late" durumu backend tarafından da reddedilmeli.
public class FacilityAttendanceServiceTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUser> _current = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<IFacilityRegistrationService> _registration = new();
    private readonly Mock<IFacilityNotificationService> _notification = new();
    private readonly Mock<IQrTokenService> _qr = new();
    private readonly Mock<ICitizenIdentityQrService> _cidQr = new();
    private readonly Mock<IFacilityDoorController> _door = new();
    private readonly Mock<IFacilityGroupRepository> _groups = new();
    private readonly Mock<IFacilitySessionRepository> _sessions = new();
    private readonly Mock<IFacilityRegistrationRepository> _registrations = new();
    private readonly Mock<IFacilityAttendanceRepository> _attendances = new();
    private readonly Mock<IFacilityDeviceRepository> _devices = new();
    private readonly Mock<IFacilityRepository> _facilities = new();
    private readonly IConfiguration _config;
    private readonly FacilityAttendanceService _service;

    // Kullanıcı isteği/regresyon notu: bu testler saat aralıkları üretmek için gerçek
    // `DateTime.UtcNow`'a güveniyordu. UTC gece yarısına yakın çalıştırıldığında (örn. 23:48),
    // örneğin `-1h/+1h` aralığı gece yarısını aşıyor; `FacilitySession` TEK bir `Date` alanı +
    // ayrı `StartTime`/`EndTime` string çiftiyle modellendiği (gün taşıran seans desteklenmiyor)
    // için bitiş saati ertesi güne düşerken `Date` bugün kalıyor — servis bunu "bitiş <
    // başlangıç" gibi yorumlayıp yanlışlıkla `SESSION_ENDED` fırlatarak testi rastgele (flaky)
    // bozuyordu. Kalıcı çözüm: servisin zaten okuduğu `FacilitySettings:LocalTimeZoneOffsetMinutes`
    // config değerini, servisin göreceği "local now" her zaman SABİT bir öğlen referansına denk
    // gelecek şekilde her test çalışmasında yeniden hesaplıyoruz — artık testler hangi gerçek
    // saatte koşarsa koşsun asla gece yarısı sınırına yaklaşmaz.
    private static readonly DateTime SafeLocalNowAnchor = DateTime.UtcNow.Date.AddHours(12);

    public FacilityAttendanceServiceTests()
    {
        _uow.SetupGet(x => x.FacilityGroups).Returns(_groups.Object);
        _uow.SetupGet(x => x.FacilitySessions).Returns(_sessions.Object);
        _uow.SetupGet(x => x.FacilityRegistrations).Returns(_registrations.Object);
        _uow.SetupGet(x => x.FacilityAttendances).Returns(_attendances.Object);
        _uow.SetupGet(x => x.FacilityDevices).Returns(_devices.Object);
        _uow.SetupGet(x => x.Facilities).Returns(_facilities.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _uow.Setup(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _uow.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _devices.Setup(x => x.GetByFacilityAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _facilities.Setup(x => x.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync((Facility?)null);
        _sessions.Setup(x => x.GetByGroupAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _attendances.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<FacilityAttendance, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _current.SetupGet(x => x.Id).Returns((Guid?)null);
        // LocalNow() = UtcNow + offsetMinutes; offset öyle seçilir ki servisin göreceği "local now"
        // her zaman SafeLocalNowAnchor'a denk gelsin.
        var offsetMinutes = (int)Math.Round((SafeLocalNowAnchor - DateTime.UtcNow).TotalMinutes);
        _config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["FacilitySettings:LocalTimeZoneOffsetMinutes"] = offsetMinutes.ToString(),
        }).Build();

        _service = new FacilityAttendanceService(
            _uow.Object, _current.Object, _userScope.Object, _registration.Object,
            _notification.Object, _qr.Object, _cidQr.Object, _door.Object, _config);
    }

    private static FacilityGroup CreateGroup(string attendanceMode = "full", bool lateTrackingEnabled = true)
    {
        var group = FacilityGroup.Create(new FacilityGroupData(
            "sports", Guid.NewGuid(), Guid.NewGuid(), null, "Test Grubu", "kurs", "mixed",
            10, 2, 0, 99, "[]", attendanceMode, "{}", "{}", null, null, 0, 0, 10, null, null, true, null,
            "date_range", 0, 0, null, null, false, true, false, "unlimited", 0, "month", 0, "anyone",
            lateTrackingEnabled), "tester");
        return group;
    }

    private FacilitySession CreateSessionToday(string startTime, string endTime, Guid? groupId = null)
    {
        var now = SafeLocalNowAnchor;
        return FacilitySession.Create("sports", Guid.NewGuid(), groupId ?? Guid.NewGuid(), now.Date, now.DayOfWeek.ToString().ToLowerInvariant(), startTime, endTime, "tester");
    }

    private static FacilitySession CreateSessionAtOffset(FacilityGroup group, double startOffsetHours, double endOffsetHours)
    {
        var start = SafeLocalNowAnchor.AddHours(startOffsetHours);
        var end = SafeLocalNowAnchor.AddHours(endOffsetHours);
        return FacilitySession.Create("sports", group.FacilityId, group.Id, start.Date, start.DayOfWeek.ToString().ToLowerInvariant(),
            start.ToString("HH:mm"), end.ToString("HH:mm"), "tester");
    }

    [Fact]
    public async Task SaveAsync_seans_baslamadan_once_reddedilir()
    {
        var group = CreateGroup();
        var session = CreateSessionAtOffset(group, 2, 3);

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var req = new SaveAttendanceRequest(session.Id, []);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.SaveAsync("sports", req, CancellationToken.None));
        Assert.Equal("SESSION_NOT_STARTED", ex.ErrorCode);
    }

    [Fact]
    public async Task SaveAsync_seans_bittikten_sonra_reddedilir()
    {
        var group = CreateGroup();
        var session = CreateSessionAtOffset(group, -3, -2);

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var req = new SaveAttendanceRequest(session.Id, []);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.SaveAsync("sports", req, CancellationToken.None));
        Assert.Equal("SESSION_ENDED", ex.ErrorCode);
    }

    [Fact]
    public async Task SaveAsync_seans_devam_ederken_kabul_edilir()
    {
        var group = CreateGroup();
        var session = CreateSessionAtOffset(group, -1, 1);

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var req = new SaveAttendanceRequest(session.Id, []);
        var result = await _service.SaveAsync("sports", req, CancellationToken.None);
        Assert.Equal(0, result.Marked);
    }

    [Fact]
    public async Task SaveAsync_gec_gelme_takibi_kapaliyken_late_reddedilir()
    {
        var group = CreateGroup(lateTrackingEnabled: false);
        var session = CreateSessionAtOffset(group, -1, 1);
        var registration = FacilityRegistration.Create("sports", group.FacilityId, group.Id, group.BranchId, null, Guid.NewGuid(),
            "Test Kişi", "12345678901", "5551234567", null, null, "main", 0, null, null);

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([registration]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var req = new SaveAttendanceRequest(session.Id, [new AttendanceMark(registration.Id, "late")]);
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.SaveAsync("sports", req, CancellationToken.None));
        Assert.Equal("LATE_TRACKING_DISABLED", ex.ErrorCode);
    }

    [Fact]
    public async Task CorrectAsync_seans_bittikten_sonra_da_calisir_yetkili_muaf()
    {
        var group = CreateGroup();
        var session = CreateSessionAtOffset(group, -3, -2);

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);
        // P1-5 düzeltmesi: isCorrection=true iken SaveRosterAsync artık removed kayıtları da
        // bulabilmek için FindAsync(r => r.GroupId == ...) çağırıyor (GetByGroupAsync yerine).
        _registrations.Setup(x => x.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<FacilityRegistration, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var req = new SaveAttendanceRequest(session.Id, [], true);
        var result = await _service.CorrectAsync("sports", req, CancellationToken.None);
        Assert.Equal(0, result.Marked);
    }

    // Kod denetimi 2026-08-02 (kullanıcı isteği: en ufak hata ciddi maddi zarara yol açar):
    // CheckInAsync (personel manuel TC girişi, /attendance/check-in) eskiden CheckedInAt set
    // etmiyordu — bu yüzden RecurringJobsBootstrapper.FacilityAutoCheckoutJob (CheckedInAt != null
    // filtresi) bu kişiyi asla bulamıyor, kişi kapasitede sonsuza kadar "içeride" görünebiliyordu.
    [Fact]
    public async Task CheckInAsync_yeni_kayitta_CheckedInAt_set_eder()
    {
        var group = CreateGroup();
        var session = CreateSessionAtOffset(group, -1, 1);
        var registration = FacilityRegistration.Create("sports", group.FacilityId, group.Id, group.BranchId, null, Guid.NewGuid(),
            "Test Kişi", "12345678901", "5551234567", null, null, "main", 0, null, null);

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([registration]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        FacilityAttendance? added = null;
        _attendances.Setup(x => x.AddAsync(It.IsAny<FacilityAttendance>(), It.IsAny<CancellationToken>()))
            .Callback<FacilityAttendance, CancellationToken>((a, _) => added = a)
            .Returns(Task.CompletedTask);

        var result = await _service.CheckInAsync("sports", session.Id, registration.Tckn, CancellationToken.None);

        Assert.NotNull(added);
        Assert.NotNull(added!.CheckedInAt);
        Assert.Equal("present", result.Status);
    }

    // Aynı hata var olan (`FacilityAttendance` zaten mevcut, güncelleniyor) dalda da doğrulanmalı.
    [Fact]
    public async Task CheckInAsync_mevcut_kayitta_da_CheckedInAt_set_eder()
    {
        var group = CreateGroup();
        var session = CreateSessionAtOffset(group, -1, 1);
        var registration = FacilityRegistration.Create("sports", group.FacilityId, group.Id, group.BranchId, null, Guid.NewGuid(),
            "Test Kişi", "12345678901", "5551234567", null, null, "main", 0, null, null);
        var existing = FacilityAttendance.Create("sports", group.FacilityId, group.Id, session.Id,
            registration.Id, registration.ParticipantId, registration.FullName, registration.Tckn, "absent", "roster", "tester");

        _sessions.Setup(x => x.GetByIdAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync(session);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([registration]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([existing]);

        Assert.Null(existing.CheckedInAt);
        await _service.CheckInAsync("sports", session.Id, registration.Tckn, CancellationToken.None);

        Assert.NotNull(existing.CheckedInAt);
    }

    // Kiosk (manuel/QR) girişi de aynı gerçek hatadan etkileniyordu — CheckInByFacilityAsync.
    [Fact]
    public async Task CheckInByFacilityAsync_CheckedInAt_set_eder()
    {
        var group = CreateGroup();
        var facilityId = group.FacilityId;
        var session = CreateSessionAtOffset(group, -1, 1);
        var registration = FacilityRegistration.Create("sports", facilityId, group.Id, group.BranchId, null, Guid.NewGuid(),
            "Test Kişi", "12345678901", "5551234567", null, null, "main", 0, null, null);

        _facilities.Setup(x => x.GetByIdAsync(facilityId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Facility.Create(new FacilityData("sports", "Test Tesis", "indoor", null, 0, null, null, null, null, null, null, null, true), "SPR-001", "tester"));
        _sessions.Setup(x => x.GetByDayAsync("sports", facilityId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync([session]);
        _groups.Setup(x => x.GetByIdAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync(group);
        _registrations.Setup(x => x.GetByGroupAsync(group.Id, It.IsAny<CancellationToken>())).ReturnsAsync([registration]);
        _attendances.Setup(x => x.GetBySessionAsync(session.Id, It.IsAny<CancellationToken>())).ReturnsAsync([]);

        FacilityAttendance? added = null;
        _attendances.Setup(x => x.AddAsync(It.IsAny<FacilityAttendance>(), It.IsAny<CancellationToken>()))
            .Callback<FacilityAttendance, CancellationToken>((a, _) => added = a)
            .Returns(Task.CompletedTask);

        var result = await _service.CheckInByFacilityAsync("sports", facilityId, registration.Tckn, "manual", CancellationToken.None);

        Assert.True(result.Found);
        Assert.NotNull(added);
        Assert.NotNull(added!.CheckedInAt);
    }
}
