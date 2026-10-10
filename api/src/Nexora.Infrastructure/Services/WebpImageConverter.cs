using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;

namespace Nexora.Infrastructure.Services;

public static class WebpImageConverter
{
    public const string WebpContentType = "image/webp";

    private static readonly string[] PassThroughContentTypes = ["image/webp", "image/svg+xml", "image/gif"];

    public static async Task<(Stream Stream, string FileName, string ContentType, bool OwnsStream)> ConvertAsync(
        Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        if (IsPassThrough(fileName, contentType))
            return (stream, fileName, contentType, false);

        var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        buffer.Position = 0;

        try
        {
            using var image = await Image.LoadAsync(buffer, ct);
            var output = new MemoryStream();
            await image.SaveAsync(output, new WebpEncoder(), ct);
            output.Position = 0;
            return (output, ToWebpFileName(fileName), WebpContentType, true);
        }
        catch
        {
            buffer.Position = 0;
            return (buffer, fileName, contentType, true);
        }
    }

    private static bool IsPassThrough(string fileName, string contentType)
    {
        if (PassThroughContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            return true;

        var extension = Path.GetExtension(fileName);
        return extension.Equals(".webp", StringComparison.OrdinalIgnoreCase)
            || extension.Equals(".svg", StringComparison.OrdinalIgnoreCase)
            || extension.Equals(".gif", StringComparison.OrdinalIgnoreCase);
    }

    private static string ToWebpFileName(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName);
        return string.IsNullOrWhiteSpace(name) ? "gorsel.webp" : $"{name}.webp";
    }
}
