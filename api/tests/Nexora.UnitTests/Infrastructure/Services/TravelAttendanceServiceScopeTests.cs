using Microsoft.Extensions.Configuration;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Travels;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Regresyon koruması: TravelAttendanceService'in tesis-bazlı scope'lanmış bir "Gezi Sorumlusu"
// kullanıcısının başka bir gezinin yoklama listesine (yolcu ad+TCKN) erişemediğini kanıtlar
// (bkz. programci_salon.md 3.2.3).
public class TravelAttendanceServiceScopeTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly Mock<IExcelService> _excelService = new();
    private readonly Mock<ILoyaltyService> _loyalty = new();
    private readonly Mock<IUserScopeService> _userScope = new();
    private readonly Mock<IConfiguration> _config = new();
    private readonly Mock<ITravelRepository> _travels = new();
    private readonly TravelAttendanceService _service;

    private static readonly Guid AdminUserId = Guid.NewGuid();
    private static readonly Guid OwnTravelId = Guid.NewGuid();
    private static readonly Guid OtherTravelId = Guid.NewGuid();

    public TravelAttendanceServiceScopeTests()
    {
        _uow.SetupGet(x => x.Travels).Returns(_travels.Object);
        _currentUser.SetupGet(x => x.Id).Returns(AdminUserId);
        _userScope.Setup(x => x.GetScopedRefIdsAsync(AdminUserId, "travels", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new HashSet<Guid> { OwnTravelId });

        _service = new TravelAttendanceService(
            _uow.Object, _currentUser.Object, _audit.Object, _excelService.Object,
            _loyalty.Object, _userScope.Object, _config.Object);
    }

    [Fact]
    public async Task GetRosterAsync_baska_geziye_scope_disi_erisim_NotFound_firlatir()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.GetRosterAsync(OtherTravelId, CancellationToken.None));

        _travels.Verify(x => x.GetByIdAsync(OtherTravelId, It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ReopenAsync_baska_geziye_scope_disi_erisim_NotFound_firlatir()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ReopenAsync(OtherTravelId, CancellationToken.None));

        _travels.Verify(x => x.GetByIdAsync(OtherTravelId, It.IsAny<CancellationToken>()), Times.Never);
    }
}
