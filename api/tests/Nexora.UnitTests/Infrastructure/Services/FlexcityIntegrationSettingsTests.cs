using Moq;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Integrations.Dtos;
using Nexora.Domain.Entities.Integrations;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Kullanıcı isteği (2026-09-25): Flexcity "sistemde olsun ama kullanmak istersek açarız".
public class FlexcityIntegrationSettingsTests
{
    private sealed class FakeEncryptor : IApiKeyEncryptor
    {
        public string Encrypt(string plainText) => "enc:" + plainText;
        public string? Decrypt(string? cipherText) => cipherText is null ? null : cipherText.StartsWith("enc:") ? cipherText[4..] : null;
        public string Mask(string plainText) => "***" + plainText[^2..];
    }

    private IntegrationSettingsRecord? _record;
    private readonly IntegrationSettingsService _svc;

    public FlexcityIntegrationSettingsTests()
    {
        var repo = new Mock<IIntegrationSettingsRepository>();
        repo.Setup(r => r.GetCurrentAsync(It.IsAny<CancellationToken>())).ReturnsAsync(() => _record);
        repo.Setup(r => r.AddAsync(It.IsAny<IntegrationSettingsRecord>(), It.IsAny<CancellationToken>()))
            .Callback<IntegrationSettingsRecord, CancellationToken>((r, _) => _record = r).Returns(Task.CompletedTask);
        var uow = new Mock<IUnitOfWork>();
        uow.SetupGet(u => u.IntegrationSettings).Returns(repo.Object);
        _svc = new IntegrationSettingsService(uow.Object, new FakeEncryptor());
    }

    private static UpdateIntegrationSettingsRequest Req(UpdateFlexcitySettingsRequest? fx) => new(
        new UpdateMapProviderRequest(false, null, false),
        new UpdateAiProviderRequest(false, null, false, null),
        new UpdateAiProviderRequest(false, null, false, null),
        new UpdateAiProviderRequest(false, null, false, null),
        null, null, fx);

    [Fact]
    public async Task Varsayilan_kapali_ve_sorgu_yapilmaz()
    {
        var s = await _svc.GetAsync(CancellationToken.None);
        Assert.False(s.Flexcity!.Enabled);
        Assert.Null(await _svc.ResolveFlexcityAsync(CancellationToken.None));
    }

    [Fact]
    public async Task Bilgiler_girilip_kapali_birakilirsa_kullanilmaz_acilinca_kullanilir()
    {
        await _svc.SaveAsync(Req(new(false, "https://flex.example.gov.tr/", "APPKEY123", "SEC456")), CancellationToken.None);
        Assert.Null(await _svc.ResolveFlexcityAsync(CancellationToken.None));
        Assert.Contains("\"enc:APPKEY123\"", _record!.ConfigJson); // şifreleyiciden geçerek saklanır
        Assert.DoesNotContain("\"APPKEY123\"", _record.ConfigJson);

        await _svc.SaveAsync(Req(new(true, null, null, null)), CancellationToken.None); // boş alan = mevcut korunur
        var r = await _svc.ResolveFlexcityAsync(CancellationToken.None);
        Assert.NotNull(r);
        Assert.Equal("https://flex.example.gov.tr", r!.BaseUrl);
        Assert.Equal("APPKEY123", r.AppKey);
        Assert.Equal("SEC456", r.SecurityCode);

        var dto = (await _svc.GetAsync(CancellationToken.None)).Flexcity!;
        Assert.True(dto.HasAppKey && dto.HasSecurityCode);
        Assert.Equal("***23", dto.MaskedAppKey);
    }

    [Fact]
    public async Task Diger_ayarlar_kaydedilince_Flexcity_bilgileri_silinmez()
    {
        await _svc.SaveAsync(Req(new(true, "https://flex.example.gov.tr", "K1", "S1")), CancellationToken.None);
        await _svc.SaveAsync(Req(null), CancellationToken.None);
        Assert.NotNull(await _svc.ResolveFlexcityAsync(CancellationToken.None));
    }

    [Fact]
    public async Task Kaldir_anahtarlari_siler_ve_kapatir()
    {
        await _svc.SaveAsync(Req(new(true, "https://flex.example.gov.tr", "K1", "S1")), CancellationToken.None);
        await _svc.SaveAsync(Req(new(false, null, null, null, ClearCredentials: true)), CancellationToken.None);
        var dto = (await _svc.GetAsync(CancellationToken.None)).Flexcity!;
        Assert.False(dto.Enabled || dto.HasAppKey || dto.HasSecurityCode);
    }

    [Fact]
    public async Task Gecersiz_adres_reddedilir()
    {
        await Assert.ThrowsAsync<Nexora.Application.Common.Exceptions.ConflictException>(() =>
            _svc.SaveAsync(Req(new(true, "ftp://x", "K", "S")), CancellationToken.None));
    }
}
