using System.Net;
using Nexora.Infrastructure.Http;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Http;

// ULAK-05: dış entegrasyon adreslerine (Ulakbel BaseUrl vb.) istek atmadan önce çalışan tek-kaynak
// SSRF doğrulaması. Boş/geçersiz/http/özel-ağ hedefler reddedilir; yalnız gerçek public https geçer.
public class OutboundUrlGuardTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void TryValidate_bos_adres_reddeder(string? url)
    {
        var ok = OutboundUrlGuard.TryValidate(url, out var error);

        Assert.False(ok);
        Assert.NotEmpty(error);
    }

    [Theory]
    [InlineData("not-a-url")]
    [InlineData("ulakbel.example.com")]
    [InlineData("/api/incident")]
    public void TryValidate_gecersiz_url_reddeder(string url)
    {
        var ok = OutboundUrlGuard.TryValidate(url, out var error);

        Assert.False(ok);
        Assert.NotEmpty(error);
    }

    [Theory]
    [InlineData("http://93.184.216.34")]
    [InlineData("ftp://93.184.216.34")]
    public void TryValidate_https_disi_semayi_reddeder(string url)
    {
        var ok = OutboundUrlGuard.TryValidate(url, out var error);

        Assert.False(ok);
        Assert.Contains("https", error);
    }

    [Theory]
    [InlineData("https://127.0.0.1")]
    [InlineData("https://10.0.0.5")]
    [InlineData("https://172.16.0.1")]
    [InlineData("https://192.168.1.1")]
    [InlineData("https://169.254.169.254")]
    [InlineData("https://0.0.0.0")]
    [InlineData("https://[::1]")]
    [InlineData("https://[fc00::1]")]
    [InlineData("https://[fe80::1]")]
    [InlineData("https://[::ffff:10.0.0.1]")]
    public void TryValidate_ic_ag_ve_reserved_adresleri_reddeder(string url)
    {
        var ok = OutboundUrlGuard.TryValidate(url, out var error);

        Assert.False(ok);
        Assert.NotEmpty(error);
    }

    [Theory]
    [InlineData("https://93.184.216.34")]
    [InlineData("https://8.8.8.8/api/incident")]
    [InlineData("https://1.1.1.1")]
    public void TryValidate_public_https_kabul_eder(string url)
    {
        var ok = OutboundUrlGuard.TryValidate(url, out var error);

        Assert.True(ok, error);
        Assert.Empty(error);
    }

    [Theory]
    [InlineData("127.0.0.1", true)]
    [InlineData("10.255.255.255", true)]
    [InlineData("172.31.0.1", true)]
    [InlineData("172.15.0.1", false)]
    [InlineData("172.32.0.1", false)]
    [InlineData("192.168.0.1", true)]
    [InlineData("169.254.0.1", true)]
    [InlineData("0.0.0.0", true)]
    [InlineData("100.64.0.1", true)]
    [InlineData("100.127.255.255", true)]
    [InlineData("100.63.0.1", false)]
    [InlineData("100.128.0.1", false)]
    [InlineData("224.0.0.1", true)]
    [InlineData("240.0.0.1", true)]
    [InlineData("255.255.255.255", true)]
    [InlineData("93.184.216.34", false)]
    [InlineData("8.8.8.8", false)]
    public void IsPrivateOrReservedAddress_ipv4_araliklarini_dogru_siniflar(string ip, bool expected)
    {
        var result = OutboundUrlGuard.IsPrivateOrReservedAddress(IPAddress.Parse(ip));

        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("::", true)]
    [InlineData("::1", true)]
    [InlineData("fe80::1", true)]
    [InlineData("fc00::1", true)]
    [InlineData("ff02::1", true)]
    [InlineData("2606:4700:4700::1111", false)]
    public void IsPrivateOrReservedAddress_ipv6_araliklarini_dogru_siniflar(string ip, bool expected)
    {
        var result = OutboundUrlGuard.IsPrivateOrReservedAddress(IPAddress.Parse(ip));

        Assert.Equal(expected, result);
    }

    [Fact]
    public void IsPrivateOrReservedAddress_ipv4_mapped_ipv6_ic_ag_yakalar()
    {
        var mapped = IPAddress.Parse("10.0.0.1").MapToIPv6();

        Assert.True(OutboundUrlGuard.IsPrivateOrReservedAddress(mapped));
    }
}
