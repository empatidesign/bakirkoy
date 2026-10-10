using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.CitizenSubmissions;
using Nexora.Application.Features.Integrations;
using Nexora.Infrastructure.Services;
using Nexora.Infrastructure.Storage;
using Xunit;

namespace Nexora.UnitTests.CitizenSubmissions;

/// <summary>
/// Kullanıcı isteği (2026-09-07): gerçek ulakBELL API şemasına göre yeniden yazılan
/// UlakbelForwardService'in ürettiği HTTP isteğinin, ulakBELL'in resmi Postman
/// koleksiyonunda belgelenen /api/incident şemasına (source_id, text, incident_type,
/// geogrophic_coordinate, mobile_phone) uyduğunu ve public_token'ı takip numarası
/// olarak doğru çıkardığını kanıtlar. Gerçek belediye sunucusuna bu ortamdan (SSRF
/// koruması + ağ erişimi) ulaşılamadığı için, sahte bir HttpMessageHandler ile
/// giden isteğin gövdesi yakalanıp doğrulanır.
/// </summary>
public class UlakbelForwardServiceTests
{
    private sealed class RecordingHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest;
        public string? LastRequestBody;
        public string ResponseBody = "{}";
        public HttpStatusCode StatusCode = HttpStatusCode.OK;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            LastRequest = request;
            if (request.Content is not null)
                LastRequestBody = await request.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(StatusCode) { Content = new StringContent(ResponseBody) };
        }
    }

    private sealed class ThrowingHandler(Exception toThrow) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            throw toThrow;
    }

    private sealed class SingleClientFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    private static UlakbelForwardService BuildServiceWithThrowingHandler(Exception toThrow, ResolvedUlakbelConfig config)
    {
        var httpClient = new HttpClient(new ThrowingHandler(toThrow));
        var factory = new SingleClientFactory(httpClient);
        var settings = new Mock<IIntegrationSettingsService>();
        settings.Setup(s => s.ResolveUlakbelAsync(It.IsAny<CancellationToken>())).ReturnsAsync(config);
        return new UlakbelForwardService(factory, settings.Object, new Mock<IFileStorageService>().Object,
            Options.Create(new MinioSettings()), NullLogger<UlakbelForwardService>.Instance);
    }

    private static UlakbelForwardService BuildService(
        RecordingHandler handler,
        ResolvedUlakbelConfig? config,
        Mock<IFileStorageService>? fileStorage = null)
    {
        var httpClient = new HttpClient(handler);
        var factory = new SingleClientFactory(httpClient);

        var settings = new Mock<IIntegrationSettingsService>();
        settings.Setup(s => s.ResolveUlakbelAsync(It.IsAny<CancellationToken>())).ReturnsAsync(config);

        var storage = fileStorage ?? new Mock<IFileStorageService>();
        var minio = Options.Create(new MinioSettings());

        return new UlakbelForwardService(factory, settings.Object, storage.Object, minio, NullLogger<UlakbelForwardService>.Instance);
    }

    private static UlakbelForwardRequest SampleRequest() => new(
        SubmissionId: Guid.NewGuid(),
        TrackingNo: "NX-2026-0001",
        CitizenPhone: "0553 555 55 55",
        Title: "Kaldırım bozuk",
        Description: "Mahallede kaldırım taşları kırık.",
        Neighborhood: "Cebeci Mahallesi",
        Address: "2350 Sk. No:1",
        Latitude: 41.1065,
        Longitude: 28.8672,
        CategoryLabel: "Kaldırım",
        Priority: "normal",
        TargetUnit: "Fen İşleri Müdürlüğü",
        MediaUrls: []);

    [Fact]
    public async Task ForwardAsync_kapaliysa_gonderim_ve_sahte_takip_numarasi_olusturmaz()
    {
        var handler = new RecordingHandler();
        var service = BuildService(handler, config: null);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.IsSimulated);
        Assert.False(result.Success);
        Assert.Empty(result.TrackingNo);
        Assert.Contains("kapalı", result.ErrorMessage);
        Assert.Null(handler.LastRequest); // gerçek API'ye hiç istek atılmamalı
    }

    [Fact]
    public async Task ForwardAsync_sourceId_eksikse_hata_doner()
    {
        var handler = new RecordingHandler();
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "test-token", SourceId: null);
        var service = BuildService(handler, config);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.IsSimulated);
        Assert.False(result.Success);
        Assert.Contains("Source ID", result.ErrorMessage);
        Assert.Null(handler.LastRequest);
    }

    [Fact]
    public async Task ForwardAsync_gercek_API_semasina_uygun_istek_gonderir()
    {
        var handler = new RecordingHandler
        {
            ResponseBody = """{"number": 1112, "public_token": "j0Rd6YkY664EifBh5sfSLl0lKCoFjqW4TFbVOUHdq"}""",
        };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "test-token-abc", SourceId: 38);
        var service = BuildService(handler, config);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.IsSimulated);
        Assert.True(result.Success, result.ErrorMessage);
        // API yanıtındaki public_token, en yüksek öncelikli takip no olarak çıkarılmalı.
        Assert.Equal("j0Rd6YkY664EifBh5sfSLl0lKCoFjqW4TFbVOUHdq", result.TrackingNo);

        Assert.NotNull(handler.LastRequest);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.Equal("https://93.184.216.34/api/incident", handler.LastRequest.RequestUri!.ToString());
        Assert.Equal("Bearer", handler.LastRequest.Headers.Authorization!.Scheme);
        Assert.Equal("test-token-abc", handler.LastRequest.Headers.Authorization.Parameter);

        Assert.NotNull(handler.LastRequestBody);
        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        var root = doc.RootElement;

        // Gerçek ulakBELL şeması: source_id zorunlu ve int olmalı.
        Assert.Equal(38, root.GetProperty("source_id").GetInt32());
        // text alanı başlık+açıklama+bağlam içermeli (adres/mahalle bilgisi burada taşınıyor).
        var text = root.GetProperty("text").GetString();
        Assert.Contains("Kaldırım bozuk", text);
        Assert.Contains("Cebeci Mahallesi", text);
        Assert.Contains("2350 Sk. No:1", text);
        // incident_type geçerli bir ulakBELL değeri olmalı.
        var incidentType = root.GetProperty("incident_type").GetString();
        Assert.Contains(incidentType, new[] { "demand", "complaint", "thank", "project", "information", "notice" });
        // Telefon 0 önekisiz 10 haneli sayı olarak gönderilmeli (ulakBELL örneği: 5535555555).
        Assert.Equal(5535555555L, root.GetProperty("mobile_phone").GetInt64());
        // Koordinat alanı geogrophic_coordinate (ulakBELL'in kendi yazım hatası dahil) altında olmalı.
        var geo = root.GetProperty("geogrophic_coordinate");
        Assert.Equal(41.1065, geo.GetProperty("lat").GetDouble());
        Assert.Equal(28.8672, geo.GetProperty("long").GetDouble());
    }

    [Fact]
    public async Task ForwardAsync_HTTP_hata_donerse_basarisiz_sonuc_uretir()
    {
        var handler = new RecordingHandler { StatusCode = HttpStatusCode.InternalServerError, ResponseBody = "{}" };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "test-token", SourceId: 38);
        var service = BuildService(handler, config);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.IsSimulated);
        Assert.False(result.Success);
        Assert.Contains("500", result.ErrorMessage);
    }

    [Fact]
    public async Task ForwardAsync_telefon_11_haneli_0_ile_baslarsa_dogru_normalize_edilir()
    {
        var handler = new RecordingHandler { ResponseBody = """{"public_token": "abc"}""" };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "tok", SourceId: 1);
        var service = BuildService(handler, config);

        var req = SampleRequest() with { CitizenPhone = "05355555555" };
        await service.ForwardAsync(req, CancellationToken.None);

        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        Assert.Equal(5355555555L, doc.RootElement.GetProperty("mobile_phone").GetInt64());
    }

    [Fact]
    public async Task ForwardAsync_gecersiz_telefon_mobile_phone_alanini_atlar()
    {
        var handler = new RecordingHandler { ResponseBody = """{"public_token": "abc"}""" };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "tok", SourceId: 1);
        var service = BuildService(handler, config);

        var req = SampleRequest() with { CitizenPhone = "geçersiz" };
        await service.ForwardAsync(req, CancellationToken.None);

        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        Assert.False(doc.RootElement.TryGetProperty("mobile_phone", out _));
    }

    // ULAK-02: HTTP 2xx tek başına teslim kanıtı değildir — sözleşmeye uymayan yanıt başarı üretmez,
    // yerel/rastgele takip numarasına DÜŞÜLMEZ.
    [Theory]
    [InlineData("{}")]
    [InlineData("")]
    [InlineData("<html><body>Giriş yapın</body></html>")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("""{"success": false}""")]
    [InlineData("""{"error": "invalid source"}""")]
    [InlineData("""{"public_token": ""}""")]
    [InlineData("""{"public_token": "   "}""")]
    [InlineData("""{"public_token": "", "number": 0}""")]
    [InlineData("""{"number": -5}""")]
    public async Task ForwardAsync_gecersiz_2xx_yaniti_basari_uretmez_ULAK02(string responseBody)
    {
        var handler = new RecordingHandler { StatusCode = HttpStatusCode.OK, ResponseBody = responseBody };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "tok", SourceId: 38);
        var service = BuildService(handler, config);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Empty(result.TrackingNo);
    }

    // ULAK-02: public_token boş olsa da geçerli pozitif number gerçek uzak kimliktir → başarı.
    [Fact]
    public async Task ForwardAsync_bos_token_ama_gecerli_number_basari_uretir_ULAK02()
    {
        var handler = new RecordingHandler { ResponseBody = """{"public_token": "", "number": 1112}""" };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "tok", SourceId: 38);
        var service = BuildService(handler, config);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.True(result.Success, result.ErrorMessage);
        Assert.Equal("1112", result.TrackingNo);
    }

    // ULAK-05: gerçek gönderim yolu da SSRF doğrulamasından geçer — loopback/özel/http hedefe HİÇ istek atılmaz.
    [Theory]
    [InlineData("https://127.0.0.1")]
    [InlineData("https://10.0.0.5")]
    [InlineData("https://169.254.169.254")]
    [InlineData("http://93.184.216.34")]
    [InlineData("https://[::1]")]
    [InlineData("https://[::ffff:10.0.0.1]")]
    public async Task ForwardAsync_guvensiz_url_hicbir_istek_atmadan_reddedilir_ULAK05(string baseUrl)
    {
        var handler = new RecordingHandler();
        var config = new ResolvedUlakbelConfig(baseUrl, "tok", SourceId: 38);
        var service = BuildService(handler, config);

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Null(handler.LastRequest);
    }

    // ULAK-12: +90/0090 ülke-kodu varyantları 10 haneli ulakBELL biçimine indirilir.
    [Theory]
    [InlineData("+90 535 555 55 55", 5355555555L)]
    [InlineData("0090 535 555 55 55", 5355555555L)]
    [InlineData("90 535 555 55 55", 5355555555L)]
    [InlineData("(0535) 555 55 55", 5355555555L)]
    public async Task ForwardAsync_ulke_kodu_varyantlari_normalize_edilir_ULAK12(string phone, long expected)
    {
        var handler = new RecordingHandler { ResponseBody = """{"public_token": "abc"}""" };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "tok", SourceId: 1);
        var service = BuildService(handler, config);

        await service.ForwardAsync(SampleRequest() with { CitizenPhone = phone }, CancellationToken.None);

        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        Assert.Equal(expected, doc.RootElement.GetProperty("mobile_phone").GetInt64());
    }

    // ULAK-03 (A): gönderim SONRASI bağlantı kesilmesi (ResponseEnded) → uzak kayıt oluşmuş olabilir → Unknown.
    [Fact]
    public async Task ForwardAsync_yanit_baglantisi_kesilirse_belirsiz_doner_ULAK03A()
    {
        var ex = new HttpRequestException(HttpRequestError.ResponseEnded, "bağlantı kesildi");
        var service = BuildServiceWithThrowingHandler(ex, new ResolvedUlakbelConfig("https://93.184.216.34", "tok", 38));

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(UlakbelForwardOutcome.Unknown, result.Outcome);
    }

    // ULAK-03 (A): gönderim ÖNCESİ kesin hata (DNS/connect/TLS) → istek ulaşmadı → güvenle yeniden (Failed).
    [Theory]
    [InlineData(HttpRequestError.NameResolutionError)]
    [InlineData(HttpRequestError.ConnectionError)]
    [InlineData(HttpRequestError.SecureConnectionError)]
    public async Task ForwardAsync_gonderim_oncesi_kesin_hata_guvenle_yeniden_ULAK03A(HttpRequestError error)
    {
        var ex = new HttpRequestException(error, "ulaşılamadı");
        var service = BuildServiceWithThrowingHandler(ex, new ResolvedUlakbelConfig("https://93.184.216.34", "tok", 38));

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(UlakbelForwardOutcome.Failed, result.Outcome);
    }

    // ULAK-03: timeout (caller iptali DEĞİL) → belirsiz.
    [Fact]
    public async Task ForwardAsync_timeout_belirsiz_doner_ULAK03()
    {
        var service = BuildServiceWithThrowingHandler(new TaskCanceledException("timeout"),
            new ResolvedUlakbelConfig("https://93.184.216.34", "tok", 38));

        var result = await service.ForwardAsync(SampleRequest(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal(UlakbelForwardOutcome.Unknown, result.Outcome);
    }

    // ULAK-03 (B): gerçek caller iptali (ct) yukarı fırlatılır — durum yönetimi servis katmanında yapılır.
    [Fact]
    public async Task ForwardAsync_caller_iptalinde_OperationCanceled_firlatir_ULAK03B()
    {
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        var service = BuildServiceWithThrowingHandler(new OperationCanceledException(cts.Token),
            new ResolvedUlakbelConfig("https://93.184.216.34", "tok", 38));

        await Assert.ThrowsAsync<OperationCanceledException>(() => service.ForwardAsync(SampleRequest(), cts.Token));
    }

    // ULAK-12: TR mobil olmayan/eksik numara sessizce kırpılıp gönderilmez.
    [Theory]
    [InlineData("+1 202 555 0143")]
    [InlineData("0212 555 55 55")]
    [InlineData("535 55 55")]
    public async Task ForwardAsync_desteklenmeyen_numara_mobile_phone_atlanir_ULAK12(string phone)
    {
        var handler = new RecordingHandler { ResponseBody = """{"public_token": "abc"}""" };
        var config = new ResolvedUlakbelConfig("https://93.184.216.34", "tok", SourceId: 1);
        var service = BuildService(handler, config);

        await service.ForwardAsync(SampleRequest() with { CitizenPhone = phone }, CancellationToken.None);

        using var doc = JsonDocument.Parse(handler.LastRequestBody!);
        Assert.False(doc.RootElement.TryGetProperty("mobile_phone", out _));
    }
}
