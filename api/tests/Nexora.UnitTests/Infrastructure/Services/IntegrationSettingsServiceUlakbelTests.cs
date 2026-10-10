using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Integrations.Dtos;
using Nexora.Domain.Entities.Integrations;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// ULAK-01: panel doğrulamasına ek olarak backend paritesi — geçersiz Source ID / https-dışı adres
// kaydedilemez. `int?` alan tipi tek başına pozitiflik doğrulaması değildir.
public class IntegrationSettingsServiceUlakbelTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IIntegrationSettingsRepository> _repo = new();
    private readonly Mock<IApiKeyEncryptor> _encryptor = new();
    private readonly IntegrationSettingsService _service;

    public IntegrationSettingsServiceUlakbelTests()
    {
        _uow.Setup(u => u.IntegrationSettings).Returns(_repo.Object);
        _repo.Setup(r => r.GetCurrentAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((IntegrationSettingsRecord?)null);
        _service = new IntegrationSettingsService(_uow.Object, _encryptor.Object);
    }

    private static UpdateIntegrationSettingsRequest RequestWithUlakbel(UpdateUlakbelSettingsRequest ulakbel) =>
        new(
            new UpdateMapProviderRequest(false, null, false),
            new UpdateAiProviderRequest(false, null, false, null),
            new UpdateAiProviderRequest(false, null, false, null),
            new UpdateAiProviderRequest(false, null, false, null),
            null,
            ulakbel);

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task SaveAsync_gecersiz_source_id_reddeder(int sourceId)
    {
        var req = RequestWithUlakbel(new UpdateUlakbelSettingsRequest(true, "https://ulakbell.example.com", "tok", false, true, sourceId));

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.SaveAsync(req, CancellationToken.None));
        Assert.Equal("INVALID_ULAKBEL_SOURCE_ID", ex.ErrorCode);
    }

    [Fact]
    public async Task SaveAsync_https_disi_adres_reddeder()
    {
        var req = RequestWithUlakbel(new UpdateUlakbelSettingsRequest(true, "http://ulakbell.example.com", "tok", false, true, 38));

        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.SaveAsync(req, CancellationToken.None));
        Assert.Equal("INVALID_ULAKBEL_URL", ex.ErrorCode);
    }
}
