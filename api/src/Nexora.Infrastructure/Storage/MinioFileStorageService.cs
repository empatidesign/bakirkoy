using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Storage;

public static class FileUrl
{
    private static readonly HashSet<string> InternalHosts = new(StringComparer.OrdinalIgnoreCase);

    public static void ConfigureInternalHost(string? hostOrEndpoint)
    {
        if (string.IsNullOrWhiteSpace(hostOrEndpoint)) return;
        var value = hostOrEndpoint.Trim();
        string host;
        if (value.Contains("://"))
        {
            host = Uri.TryCreate(value, UriKind.Absolute, out var parsed) ? parsed.Host : value;
        }
        else
        {
            host = value.Split(':', 2)[0];
        }
        if (!string.IsNullOrWhiteSpace(host)) InternalHosts.Add(host);
    }

    public static string Public(string? objectName) => Build("public", objectName);

    public static string Private(string? objectName) => Build("private", objectName);

    public static string? ObjectNameFromUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        foreach (var scope in new[] { "public", "private" })
        {
            var prefix = $"/api/v1/files/{scope}/";
            if (url.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var rest = url[prefix.Length..];
                return string.Join('/', rest.Split('/').Select(Uri.UnescapeDataString));
            }
        }
        return null;
    }

    public static string? Normalize(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return url;
        if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return url;
        try
        {
            var uri = new Uri(url);
            if (!InternalHosts.Contains(uri.Host)) return url; // bilinmeyen/harici host -> dokunma
            var segments = uri.AbsolutePath.TrimStart('/').Split('/', 2);
            if (segments.Length < 2) return url;
            var objectName = Uri.UnescapeDataString(segments[1]);
            return segments[0].Contains("private", StringComparison.OrdinalIgnoreCase)
                ? Private(objectName)
                : Public(objectName);
        }
        catch
        {
            return url;
        }
    }

    public static string NormalizeImagesJson(string? imagesJson)
    {
        if (string.IsNullOrWhiteSpace(imagesJson)) return string.IsNullOrWhiteSpace(imagesJson) ? "{}" : imagesJson!;
        try
        {
            var node = System.Text.Json.Nodes.JsonNode.Parse(imagesJson);
            if (node is null) return imagesJson;
            NormalizeNode(node);
            return node.ToJsonString();
        }
        catch
        {
            return imagesJson;
        }
    }

    private static void NormalizeNode(System.Text.Json.Nodes.JsonNode node)
    {
        if (node is System.Text.Json.Nodes.JsonObject obj)
        {
            foreach (var key in obj.Select(kv => kv.Key).ToList())
            {
                var child = obj[key];
                if (key == "url" && child is System.Text.Json.Nodes.JsonValue jv && jv.TryGetValue<string>(out var s))
                    obj[key] = Normalize(s);
                else if (child is not null)
                    NormalizeNode(child);
            }
        }
        else if (node is System.Text.Json.Nodes.JsonArray arr)
        {
            foreach (var item in arr)
                if (item is not null) NormalizeNode(item);
        }
    }

    private static string Build(string scope, string? objectName)
    {
        if (string.IsNullOrWhiteSpace(objectName)) return "";
        if (objectName.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || objectName.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            || objectName.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            return objectName;

        var encoded = string.Join('/', objectName.Split('/').Select(Uri.EscapeDataString));
        return $"/api/v1/files/{scope}/{encoded}";
    }
}

public class MinioFileStorageService(IMinioClient minio, IOptions<MinioSettings> options, ILogger<MinioFileStorageService> logger, IHttpClientFactory httpClientFactory) : IFileStorageService
{
    private readonly MinioSettings _settings = options.Value;

    public async Task<UploadResult> UploadAsync(Stream stream, string fileName, string contentType, string bucket = "nexora-public", CancellationToken ct = default, string? keyPrefix = null)
    {
        await EnsureBucketAsync(bucket, ct);

        // Tüm yükleme yollarının ortak noktası burası — hangi servisten çağrılırsa
        // çağrılsın (bkz. #5) uzantı/tip kara listesi burada zorunlu olarak uygulanır.
        // Ayrı ayrı her servisin EnsureSafeDocument çağırmayı hatırlaması gerekmiyor.
        Nexora.Application.Common.SafeUploadValidation.EnsureSafeDocument(fileName, contentType);

        var safeFileName = SanitizeFileName(fileName);

        await EnsureUploadContentAllowedAsync(stream, ct);

        var safePrefix = string.IsNullOrWhiteSpace(keyPrefix) ? "" : $"{keyPrefix.Trim('/')}/";
        var objectName = $"{safePrefix}{Guid.NewGuid():N}_{safeFileName}";
        var size = stream.CanSeek ? stream.Length : -1;

        var args = new PutObjectArgs()
            .WithBucket(bucket)
            .WithObject(objectName)
            .WithStreamData(stream)
            .WithObjectSize(size)
            .WithContentType(contentType);

        await minio.PutObjectAsync(args, ct);

        try
        {
            await minio.StatObjectAsync(new StatObjectArgs().WithBucket(bucket).WithObject(objectName), ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[MinIO] Upload dogrulanamadi {Object} in {Bucket}", objectName, bucket);
            throw new ConflictException("Dosya yüklenemedi. Lütfen tekrar deneyin.", "FILE_UPLOAD_FAILED");
        }

        var url = bucket == _settings.PublicBucket
            ? FileUrl.Public(objectName)
            : FileUrl.Private(objectName);

        logger.LogInformation("[MinIO] Uploaded {Object} to {Bucket}", objectName, bucket);
        return new UploadResult(url, objectName, bucket, size);
    }

    private static async Task EnsureUploadContentAllowedAsync(Stream stream, CancellationToken ct)
    {
        if (!stream.CanSeek || stream.Length <= 0) return;

        var length = (int)Math.Min(512, stream.Length);
        var buffer = new byte[length];
        var read = await stream.ReadAsync(buffer.AsMemory(0, length), ct);
        stream.Seek(0, SeekOrigin.Begin);

        if (IsDisallowedUploadContent(buffer.AsSpan(0, read)))
            throw new ConflictException("Bu dosya güvenlik nedeniyle yüklenemez. Yalnızca geçerli görsel, video veya belge yükleyebilirsiniz.", "UNSAFE_FILE_CONTENT");
    }

    private static bool IsDisallowedUploadContent(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 2 && header[0] == 0x4D && header[1] == 0x5A) return true;
        if (header.Length >= 4 && header[0] == 0x7F && header[1] == 0x45 && header[2] == 0x4C && header[3] == 0x46) return true;

        var i = 0;
        if (header.Length >= 3 && header[0] == 0xEF && header[1] == 0xBB && header[2] == 0xBF) i = 3;
        while (i < header.Length && header[i] is 0x20 or 0x09 or 0x0D or 0x0A) i++;
        var rest = header[i..];

        if (StartsWithAsciiIgnoreCase(rest, "#!")
            || StartsWithAsciiIgnoreCase(rest, "<!doctype html")
            || StartsWithAsciiIgnoreCase(rest, "<html"))
            return true;

        // #5 (magic-byte bypass): GIF89a<?php ...>, PNG-header+<script> gibi polyglot
        // dosyalar geçerli bir görsel imzasıyla BAŞLAYIP aktif içeriği başlığın ilerisinde
        // gömer. StartsWith yalnızca tampon başında arıyordu ve bu polyglot'ları
        // atlıyordu. Bu yüzden aşağıdaki imzalar tamponun HERHANGİ bir yerinde
        // (Contains/IndexOf tabanlı) aranıyor.
        return ContainsAsciiIgnoreCase(header, "<?php")
            || ContainsAsciiIgnoreCase(header, "<%")
            || ContainsAsciiIgnoreCase(header, "<script")
            || ContainsAsciiIgnoreCase(header, "<body")
            || ContainsAsciiIgnoreCase(header, "<head");
    }

    private static bool ContainsAsciiIgnoreCase(ReadOnlySpan<byte> data, string needle)
    {
        if (needle.Length == 0 || data.Length < needle.Length) return false;
        for (var start = 0; start <= data.Length - needle.Length; start++)
        {
            var match = true;
            for (var j = 0; j < needle.Length; j++)
            {
                if (char.ToLowerInvariant((char)data[start + j]) != char.ToLowerInvariant(needle[j]))
                {
                    match = false;
                    break;
                }
            }
            if (match) return true;
        }
        return false;
    }

    private static bool StartsWithAsciiIgnoreCase(ReadOnlySpan<byte> data, string prefix)
    {
        if (data.Length < prefix.Length) return false;
        for (var i = 0; i < prefix.Length; i++)
        {
            if (char.ToLowerInvariant((char)data[i]) != char.ToLowerInvariant(prefix[i]))
                return false;
        }
        return true;
    }

    private static string SanitizeFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return "dosya";

        // Windows/Unix path ayraçlarına göre son segmenti al (Path.GetFileName tek
        // başına "/" ile "\\" karışık girdilerde yetersiz kalabildiği için elle de yap).
        var name = fileName.Replace('\\', '/');
        var lastSlash = name.LastIndexOf('/');
        if (lastSlash >= 0) name = name[(lastSlash + 1)..];

        name = System.IO.Path.GetFileName(name);

        // Kalan ".." veya boş segment ihtimaline karşı ek güvenlik.
        name = name.Replace("..", "_");

        if (string.IsNullOrWhiteSpace(name)) return "dosya";
        return name;
    }

    public async Task<FileDownload?> GetObjectAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default)
    {
        try
        {
            var stat = await minio.StatObjectAsync(new StatObjectArgs().WithBucket(bucket).WithObject(objectName), ct);

            // Not: `GetObjectAsync` (WithCallbackStream VEYA WithFile fark etmeksizin)
            // bu ortamda (minio-dotnet 6.0.4 + .NET 10, canlı Docker/Alpine dağıtımı)
            // gerçek veriyi indirmeden sessizce 0 byte / "dosya oluşmadı" sonucu
            // döndürüyordu — StatObjectAsync doğru boyutu raporlarken indirme adımı
            // hem senkron/async callback stream'de hem de WithFile+geçici dosyada
            // tutarlı şekilde başarısız oluyordu (canlı ortamda doğrulandı, izole
            // repro container'da ise SORUNSUZ çalışıyordu — yani SDK'nın gerçek
            // uygulama DI/singleton IMinioClient bağlamındaki iç HTTP istemcisine
            // özgü bir güvenilirlik sorunu). Sunucu tarafında obje herkese açık
            // (`mc anonymous get` = download) olduğu doğrulandığından, indirme
            // işlemi SDK'nın kendi GetObjectAsync'i yerine imzalı URL + düz
            // HttpClient GET ile yapılıyor; bu yol canlı ortamda tam ve doğru
            // baytları güvenilir şekilde döndürdüğü test edilerek doğrulandı.
            var presignedUrl = await minio.PresignedGetObjectAsync(new PresignedGetObjectArgs()
                .WithBucket(bucket)
                .WithObject(objectName)
                .WithExpiry(60));

            // SDK, presigned URL'i MinioSettings:UseSSL bayrağına göre https şemasıyla
            // üretebiliyor; ancak canlı ortamda doğrulandı ki iç MinIO sunucusu
            // (nexora-minio:9000) TLS'i HİÇ desteklemiyor ("wrong version number"
            // hatasıyla plain-HTTP handshake dönüyor) — UseSSL=true Vault ayarı bu
            // container-to-container bağlantı için yanlış/alakasız (muhtemelen dış
            // TLS-terminasyonlu erişim için). Bu yüzden şema, ayarı hiç sorgulamadan
            // sabit http olarak zorlanıyor; presigned URL zaten imzalı olduğundan
            // güvenlik payload'ın kendisinde, taşıma katmanında değil.
            var uriBuilder = new UriBuilder(presignedUrl) { Scheme = "http" };

            var http = httpClientFactory.CreateClient();
            var response = await http.GetAsync(uriBuilder.Uri, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[MinIO] Presigned GET failed {Object} in {Bucket}: {Status}", objectName, bucket, response.StatusCode);
                response.Dispose();
                http.Dispose();
                return null;
            }

            var contentStream = await response.Content.ReadAsStreamAsync(ct);
            var wrappedStream = new AutoDisposingStream(contentStream, response, http);
            var contentType = string.IsNullOrWhiteSpace(stat.ContentType) ? "application/octet-stream" : stat.ContentType;
            return new FileDownload(wrappedStream, contentType, stat.Size);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[MinIO] GetObject failed {Object} in {Bucket}", objectName, bucket);
            return null;
        }
    }

    private sealed class AutoDisposingStream(Stream innerStream, IDisposable response, IDisposable client) : Stream
    {
        public override bool CanRead => innerStream.CanRead;
        public override bool CanSeek => innerStream.CanSeek;
        public override bool CanWrite => innerStream.CanWrite;
        public override long Length => innerStream.Length;
        public override long Position
        {
            get => innerStream.Position;
            set => innerStream.Position = value;
        }

        public override void Flush() => innerStream.Flush();
        public override Task FlushAsync(CancellationToken cancellationToken) => innerStream.FlushAsync(cancellationToken);
        public override int Read(byte[] buffer, int offset, int count) => innerStream.Read(buffer, offset, count);
        public override int Read(Span<byte> buffer) => innerStream.Read(buffer);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => innerStream.ReadAsync(buffer, offset, count, cancellationToken);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
            => innerStream.ReadAsync(buffer, cancellationToken);
        public override long Seek(long offset, SeekOrigin origin) => innerStream.Seek(offset, origin);
        public override void SetLength(long value) => innerStream.SetLength(value);
        public override void Write(byte[] buffer, int offset, int count) => innerStream.Write(buffer, offset, count);
        public override void Write(ReadOnlySpan<byte> buffer) => innerStream.Write(buffer);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            => innerStream.WriteAsync(buffer, offset, count, cancellationToken);
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
            => innerStream.WriteAsync(buffer, cancellationToken);

        public override async ValueTask DisposeAsync()
        {
            await innerStream.DisposeAsync();
            response.Dispose();
            client.Dispose();
            await base.DisposeAsync();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                innerStream.Dispose();
                response.Dispose();
                client.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    public async Task DeleteAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default)
    {
        var args = new RemoveObjectArgs().WithBucket(bucket).WithObject(objectName);
        await minio.RemoveObjectAsync(args, ct);
        logger.LogInformation("[MinIO] Deleted {Object} from {Bucket}", objectName, bucket);
    }

    public async Task<bool> ExistsAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default)
    {
        try
        {
            var args = new StatObjectArgs().WithBucket(bucket).WithObject(objectName);
            await minio.StatObjectAsync(args, ct);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private async Task EnsureBucketAsync(string bucket, CancellationToken ct)
    {
        var exists = await minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket), ct);
        if (!exists)
            await minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket), ct);
    }
}
