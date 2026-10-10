using System.Collections.Concurrent;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Api.IntegrationTests.Infrastructure;

// F17 (denetim 2026-09-16): standart entegrasyon matrisinde MinioSettings:Endpoint
// boş bırakıldığı için (üretim Minio'suna gerçek bağlantı kurulmasın diye)
// Nexora.Infrastructure.DependencyInjection IFileStorageService'i HİÇ kaydetmiyordu.
// Bu servisi enjekte eden herhangi bir handler (ParticipantAuthService, SystemBrandingService,
// MobileConfigService, dosya/logo/splash yükleme akışları) DI çözümlemesinde patlıyor,
// yetki kapısını geçse de gerçek işlem hiç çalışmıyordu — matris logunda buna karşılık
// gelen 105 INTERNAL_SERVER_ERROR kaydı vardı.
//
// Çözüm: gerçek Minio'ya bağlanmayan ama gerçekten çalışan (upload/get/delete/exists hepsi
// doğru davranan) bellek-içi bir depo. "Throw on use" bir sahte DEĞİL — bu, yetki testinin
// storage'a hiç dokunmaması gerektiği varsayımını gizlice doğrulamak yerine, dosya akışı
// içeren gerçek başarı senaryolarının (örn. sistem logosu yükleme) da matriste test
// edilebilmesini sağlar.
public sealed class InMemoryFileStorageService : IFileStorageService
{
    private sealed record StoredFile(byte[] Bytes, string ContentType);

    private readonly ConcurrentDictionary<string, StoredFile> _store = new();

    private static string Key(string bucket, string objectName) => $"{bucket}::{objectName}";

    public async Task<UploadResult> UploadAsync(
        Stream stream, string fileName, string contentType, string bucket = "nexora-public",
        CancellationToken ct = default, string? keyPrefix = null)
    {
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        var objectName = string.IsNullOrEmpty(keyPrefix)
            ? $"{Guid.NewGuid():N}_{fileName}"
            : $"{keyPrefix}/{Guid.NewGuid():N}_{fileName}";

        _store[Key(bucket, objectName)] = new StoredFile(bytes, contentType);

        return new UploadResult($"/api/v1/files/public/{objectName}", objectName, bucket, bytes.LongLength);
    }

    public Task<FileDownload?> GetObjectAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default)
    {
        if (!_store.TryGetValue(Key(bucket, objectName), out var file))
            return Task.FromResult<FileDownload?>(null);

        return Task.FromResult<FileDownload?>(new FileDownload(new MemoryStream(file.Bytes), file.ContentType, file.Bytes.LongLength));
    }

    public Task DeleteAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default)
    {
        _store.TryRemove(Key(bucket, objectName), out _);
        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string objectName, string bucket = "nexora-public", CancellationToken ct = default)
        => Task.FromResult(_store.ContainsKey(Key(bucket, objectName)));
}
