namespace Nexora.Application.Common.Interfaces;

public record UploadResult(string Url, string ObjectName, string Bucket, long SizeBytes);

public record FileDownload(Stream Stream, string ContentType, long Length);

public interface IFileStorageService
{
    Task<UploadResult> UploadAsync(Stream stream, string fileName, string contentType, string bucket = "nexora-public", CancellationToken ct = default, string? keyPrefix = null);
    Task<FileDownload?> GetObjectAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default);
    Task DeleteAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default);
    Task<bool> ExistsAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default);
}
