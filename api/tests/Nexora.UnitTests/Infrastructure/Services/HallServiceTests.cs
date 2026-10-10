using Moq;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Halls.Dtos;
using Nexora.Domain.Entities.Halls;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class HallServiceTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IHallRepository> _halls = new();
    private readonly Mock<IUserScopeService> _scope = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly HallService _service;

    public HallServiceTests()
    {
        _uow.SetupGet(x => x.Halls).Returns(_halls.Object);
        _currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        _service = new HallService(_uow.Object, Mock.Of<IActivityLogger>(), Mock.Of<ISessionService>(),
            _scope.Object, _currentUser.Object, Mock.Of<IAuditService>());
    }

    [Fact]
    public async Task GetPagedAsync_scoped_kullanicida_kapsami_repoya_iletir_ve_toplam_repodan_gelir()
    {
        var g1 = Guid.NewGuid();
        var g2 = Guid.NewGuid();
        var scoped = new HashSet<Guid> { g1, g2 };
        _scope.Setup(x => x.GetScopedRefIdsAsync(It.IsAny<Guid>(), "halls", It.IsAny<CancellationToken>())).ReturnsAsync(scoped);
        _halls.Setup(x => x.GetPagedAsync(It.IsAny<HallListParams>(), It.IsAny<CancellationToken>(), It.IsAny<IReadOnlyCollection<Guid>?>()))
            .ReturnsAsync(new PagedResult<Hall> { Items = [], Total = 5, Page = 1, Limit = 25 });

        var result = await _service.GetPagedAsync(new HallListParams(), CancellationToken.None);

        Assert.Equal(5, result.Total);
        _halls.Verify(x => x.GetPagedAsync(It.IsAny<HallListParams>(), It.IsAny<CancellationToken>(),
            It.Is<IReadOnlyCollection<Guid>?>(ids => ids != null && ids.Count == 2 && ids.Contains(g1) && ids.Contains(g2))), Times.Once);
    }

    [Fact]
    public async Task GetPagedAsync_unscoped_kullanicida_kisitsiz_cagirir()
    {
        _scope.Setup(x => x.GetScopedRefIdsAsync(It.IsAny<Guid>(), "halls", It.IsAny<CancellationToken>())).ReturnsAsync((HashSet<Guid>?)null);
        _halls.Setup(x => x.GetPagedAsync(It.IsAny<HallListParams>(), It.IsAny<CancellationToken>(), It.IsAny<IReadOnlyCollection<Guid>?>()))
            .ReturnsAsync(new PagedResult<Hall> { Items = [], Total = 12, Page = 1, Limit = 25 });

        var result = await _service.GetPagedAsync(new HallListParams(), CancellationToken.None);

        Assert.Equal(12, result.Total);
        _halls.Verify(x => x.GetPagedAsync(It.IsAny<HallListParams>(), It.IsAny<CancellationToken>(),
            It.Is<IReadOnlyCollection<Guid>?>(ids => ids == null)), Times.Once);
    }

    [Fact]
    public async Task GetPagedAsync_kapsami_bos_kullanicida_repo_cagrilmaz()
    {
        _scope.Setup(x => x.GetScopedRefIdsAsync(It.IsAny<Guid>(), "halls", It.IsAny<CancellationToken>())).ReturnsAsync([]);

        var result = await _service.GetPagedAsync(new HallListParams(), CancellationToken.None);

        Assert.Equal(0, result.Total);
        Assert.Empty(result.Items);
        _halls.Verify(x => x.GetPagedAsync(It.IsAny<HallListParams>(), It.IsAny<CancellationToken>(), It.IsAny<IReadOnlyCollection<Guid>?>()), Times.Never);
    }
}
