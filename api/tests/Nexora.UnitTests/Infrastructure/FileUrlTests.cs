using Nexora.Infrastructure.Storage;
using Xunit;

namespace Nexora.UnitTests.Infrastructure;

public class FileUrlTests
{
    public FileUrlTests()
    {
        FileUrl.ConfigureInternalHost("minio.example.com");
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("", "")]
    [InlineData("   ", "   ")]
    public void Normalize_bos_girdiyi_oldugu_gibi_dondurur(string? input, string? expected)
    {
        Assert.Equal(expected, FileUrl.Normalize(input));
    }

    [Fact]
    public void Normalize_gorece_yolu_degistirmez()
    {
        Assert.Equal("/api/v1/files/public/foo.png", FileUrl.Normalize("/api/v1/files/public/foo.png"));
        Assert.Equal("bucket/obj.png", FileUrl.Normalize("bucket/obj.png"));
    }

    [Fact]
    public void Normalize_mutlak_public_url_i_dahili_yola_cevirir()
    {
        var result = FileUrl.Normalize("https://minio.example.com/public/klasor/resim.png");
        Assert.Equal("/api/v1/files/public/klasor/resim.png", result);
    }

    [Fact]
    public void Normalize_private_bucket_i_private_yola_cevirir()
    {
        var result = FileUrl.Normalize("https://minio.example.com/private/gizli/belge.pdf");
        Assert.Equal("/api/v1/files/private/gizli/belge.pdf", result);
    }

    [Fact]
    public void Normalize_kacisli_karakterleri_cozer()
    {
        var result = FileUrl.Normalize("https://minio.example.com/public/alt%20klasor/dosya.png");
        Assert.Equal("/api/v1/files/public/alt%20klasor/dosya.png", result);
    }

    [Fact]
    public void Public_objeyi_public_yola_koyar()
    {
        Assert.Equal("/api/v1/files/public/foo.png", FileUrl.Public("foo.png"));
    }

    [Fact]
    public void Private_objeyi_private_yola_koyar()
    {
        Assert.Equal("/api/v1/files/private/gizli.pdf", FileUrl.Private("gizli.pdf"));
    }

    [Fact]
    public void Public_bos_obje_bos_string_verir()
    {
        Assert.Equal("", FileUrl.Public(null));
        Assert.Equal("", FileUrl.Public(""));
    }

    [Fact]
    public void Public_zaten_url_olan_degeri_degistirmez()
    {
        Assert.Equal("https://cdn.example.com/x.png", FileUrl.Public("https://cdn.example.com/x.png"));
        Assert.Equal("/api/zaten/var.png", FileUrl.Public("/api/zaten/var.png"));
    }

    [Fact]
    public void NormalizeImagesJson_bos_girdiyi_bos_nesne_yapar()
    {
        Assert.Equal("{}", FileUrl.NormalizeImagesJson(null));
        Assert.Equal("{}", FileUrl.NormalizeImagesJson(""));
    }

    [Fact]
    public void NormalizeImagesJson_ic_url_leri_normalize_eder()
    {
        var input = "{\"url\": \"https://minio.example.com/public/a.png\", \"items\": [{\"url\": \"https://minio.example.com/private/b.pdf\"}]}";
        var result = FileUrl.NormalizeImagesJson(input);
        Assert.Contains("/api/v1/files/public/a.png", result);
        Assert.Contains("/api/v1/files/private/b.pdf", result);
        Assert.DoesNotContain("minio.example.com", result);
    }

    [Fact]
    public void NormalizeImagesJson_gecersiz_json_i_oldugu_gibi_dondurur()
    {
        Assert.Equal("gecersiz", FileUrl.NormalizeImagesJson("gecersiz"));
    }

    [Fact]
    public void Normalize_harici_internet_gorsel_url_sini_bozmaz()
    {
        var url = "https://picsum.photos/seed/etkinlik42/1920/1080";
        Assert.Equal(url, FileUrl.Normalize(url));
    }

    [Fact]
    public void NormalizeImagesJson_harici_internet_gorsellerini_bozmaz()
    {
        var input = "{\"ratios\":{\"16:9\":{\"url\":\"https://picsum.photos/seed/x/1920/1080\"}}}";
        var result = FileUrl.NormalizeImagesJson(input);
        Assert.Contains("https://picsum.photos/seed/x/1920/1080", result);
    }
}
