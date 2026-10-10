using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Nexora.Application.Features.Integrations;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

// Flexcity isteğinin gerçekten doğru biçimde gönderildiği (önceden Authorization başlığı
// FormatException ile düşüyor ve tarih "…xxx" gidiyordu; istek hiç atılamıyordu).
public class EmanetServiceRequestTests
{
    private sealed class CaptureHandler(string body) : HttpMessageHandler
    {
        public HttpRequestMessage? Request;
        public string? Form;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Request = request;
            Form = request.Content is null ? null : await request.Content.ReadAsStringAsync(ct);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }

    [Fact]
    public void Tarih_ISO8601_arti_uc_saat()
    {
        var s = EmanetService.FlexcityRequestDate(new DateTimeOffset(2026, 9, 25, 3, 46, 41, TimeSpan.Zero));
        Assert.Equal("2026-09-25T06:46:41+03:00", s);
    }

    [Fact]
    public async Task Istek_imzali_gonderilir_ve_geciken_odunc_kitaplar_ayiklanir()
    {
        var past = DateTime.UtcNow.AddDays(-10).ToString("o");
        var future = DateTime.UtcNow.AddDays(10).ToString("o");
        var json = $$$"""
        [
          {"id":1,"turuAsStr":"ODUNC","yasalGetirmeTarihi":"{{{past}}}","teslimEdilmeTarihi":null,"ktsEnvanterDto":{"name":"Suç ve Ceza","author":"Dostoyevski"}},
          {"id":2,"turuAsStr":"ODUNC","yasalGetirmeTarihi":"{{{future}}}","teslimEdilmeTarihi":null,"ktsEnvanterDto":{"name":"Süresi dolmamış"}},
          {"id":3,"turuAsStr":"ODUNC","yasalGetirmeTarihi":"{{{past}}}","teslimEdilmeTarihi":"{{{past}}}","ktsEnvanterDto":{"name":"İade edilmiş"}}
        ]
        """;
        var handler = new CaptureHandler(json);
        var integrations = new Mock<IIntegrationSettingsService>();
        integrations.Setup(i => i.ResolveFlexcityAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ResolvedFlexcityConfig("https://flex.example.gov.tr", "APPKEY", "SECRET"));
        integrations.Setup(i => i.GetAsync(It.IsAny<CancellationToken>())).ReturnsAsync(new Nexora.Application.Features.Integrations.Dtos.IntegrationSettingsDto(
            null!, null!, null!, null!, null, null!, new Nexora.Application.Features.Integrations.Dtos.FlexcitySettingsDto(true, "https://flex.example.gov.tr", true, "***", true)));
        var svc = new EmanetService(new HttpClient(handler), new ConfigurationBuilder().Build(), integrations.Object, NullLogger<EmanetService>.Instance);

        var r = await svc.GetOverdueAsync("10000000146", CancellationToken.None);

        Assert.NotNull(handler.Request);
        Assert.Equal("https://flex.example.gov.tr/FlexCityUi/rest/json/Kts/FindAllKtsEnvanterHareket", handler.Request!.RequestUri!.ToString());
        var auth = string.Join("", handler.Request.Headers.GetValues("Authorization"));
        Assert.Matches(@"^applicationkey=APPKEY, requestdate=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+03:00, md5hashcode=[0-9a-f]{32}$", auth);
        var date = System.Text.RegularExpressions.Regex.Match(auth, "requestdate=([^,]+)").Groups[1].Value;
        var md5 = Convert.ToHexString(System.Security.Cryptography.MD5.HashData(Encoding.UTF8.GetBytes("SECRET" + date))).ToLower();
        Assert.EndsWith(md5, auth);
        Assert.Equal("tcKimlikNo=10000000146", handler.Form);

        Assert.True(r.HasOverdue);
        Assert.Equal(1, r.Count);
        Assert.Equal("Suç ve Ceza", r.Books[0].Title);
        var st = await svc.GetStatusAsync(CancellationToken.None);
        Assert.NotNull(st.LastSuccessAt);
    }
}
