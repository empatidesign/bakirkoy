using Nexora.Infrastructure.Services;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class WebpImageConverterTests
{
    private static MemoryStream PngStream(int width = 8, int height = 8)
    {
        using var image = new Image<Rgba32>(width, height);
        var ms = new MemoryStream();
        image.Save(ms, new PngEncoder());
        ms.Position = 0;
        return ms;
    }

    [Fact]
    public async Task Png_webp_formatina_cevrilir()
    {
        await using var input = PngStream();

        var result = await WebpImageConverter.ConvertAsync(input, "ikon.png", "image/png", default);

        Assert.Equal("image/webp", result.ContentType);
        Assert.Equal("ikon.webp", result.FileName);
        Assert.True(result.OwnsStream);

        var format = await Image.DetectFormatAsync(result.Stream);
        Assert.IsType<WebpFormat>(format);

        await result.Stream.DisposeAsync();
    }

    [Fact]
    public async Task Cevrilen_gorsel_boyutlarini_korur()
    {
        await using var input = PngStream(20, 12);

        var result = await WebpImageConverter.ConvertAsync(input, "logo.PNG", "image/png", default);

        using var output = await Image.LoadAsync(result.Stream);
        Assert.Equal(20, output.Width);
        Assert.Equal(12, output.Height);

        await result.Stream.DisposeAsync();
    }

    [Fact]
    public async Task Zaten_webp_olan_dosya_yeniden_kodlanmaz()
    {
        await using var input = PngStream();

        var result = await WebpImageConverter.ConvertAsync(input, "ikon.webp", "image/webp", default);

        Assert.Same(input, result.Stream);
        Assert.Equal("ikon.webp", result.FileName);
        Assert.False(result.OwnsStream);
    }

    [Fact]
    public async Task Svg_rasterlestirilmeden_gecirilir()
    {
        await using var input = new MemoryStream("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"u8.ToArray());

        var result = await WebpImageConverter.ConvertAsync(input, "logo.svg", "image/svg+xml", default);

        Assert.Same(input, result.Stream);
        Assert.Equal("image/svg+xml", result.ContentType);
        Assert.False(result.OwnsStream);
    }

    [Fact]
    public async Task Gif_animasyonu_kaybetmemek_icin_gecirilir()
    {
        await using var input = PngStream();

        var result = await WebpImageConverter.ConvertAsync(input, "hareketli.gif", "image/gif", default);

        Assert.Same(input, result.Stream);
        Assert.False(result.OwnsStream);
    }

    [Fact]
    public async Task Cozulemeyen_dosya_oldugu_gibi_yuklenir()
    {
        await using var input = new MemoryStream("bu bir gorsel degil"u8.ToArray());

        var result = await WebpImageConverter.ConvertAsync(input, "bozuk.png", "image/png", default);

        Assert.Equal("bozuk.png", result.FileName);
        Assert.Equal("image/png", result.ContentType);

        using var reader = new StreamReader(result.Stream);
        Assert.Equal("bu bir gorsel degil", await reader.ReadToEndAsync());
    }
}
