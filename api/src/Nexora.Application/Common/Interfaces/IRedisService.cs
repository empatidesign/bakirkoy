namespace Nexora.Application.Common.Interfaces;

public interface IRedisService
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default);
    Task<T?> GetDeleteAsync<T>(string key, CancellationToken ct = default);
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default);
    Task RemoveAsync(string key, CancellationToken ct = default);
    Task<bool> TryConsumeAsync(string key, CancellationToken ct = default);
    /// <summary>Atomik SETNX+TTL: anahtar yoksa oluşturup true, zaten varsa false döner (tek kullanımlık işaretleme).</summary>
    Task<bool> TrySetIfNotExistsAsync(string key, TimeSpan ttl, CancellationToken ct = default);
    Task<string?> GetRawStringAsync(string key, CancellationToken ct = default);
    Task<bool> CompareAndConsumeAsync(string key, string expected, CancellationToken ct = default);
    /// <summary>Sahiplik-token'lı dağıtık kilit: başarılıysa bu kiralamaya özgü token döner, alınamazsa null.
    /// Dönen token yalnızca <see cref="ReleaseLockAsync"/>'e verilerek serbest bırakılmalıdır (compare-and-delete).</summary>
    Task<string?> TryAcquireLockAsync(string key, TimeSpan ttl, CancellationToken ct = default);
    /// <summary>Kilidi yalnızca değeri verilen token ile eşleşiyorsa siler (kira süresi dolup başka sahip
    /// aldıysa o sahibin kilidi silinmez). Token boşsa hiçbir şey yapmaz.</summary>
    Task ReleaseLockAsync(string key, string token, CancellationToken ct = default);
    /// <summary>Kira süresini yalnızca kilit hâlâ bu token'a aitse uzatır (compare-and-extend). Uzun süren
    /// bir işlem boyunca kilidin süresi dolup başka sahibe geçmesini önlemek için periyodik çağrılır.
    /// Sahiplik kaybedilmişse (token eşleşmezse) false döner.</summary>
    Task<bool> RenewLockAsync(string key, string token, TimeSpan ttl, CancellationToken ct = default);
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
    Task<int> GetTtlSecondsAsync(string key, CancellationToken ct = default);
    Task<long> IncrementWithExpiryAsync(string key, TimeSpan expiry, CancellationToken ct = default);

    Task SetAddAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default);
    /// <summary>Kümeye ekler ve anahtarın varsa süresini kaldırır (süresiz liste).</summary>
    Task SetAddPersistentAsync(string key, string value, CancellationToken ct = default)
        => SetAddAsync(key, value, null, ct);
    Task SetRemoveAsync(string key, string value, CancellationToken ct = default);
    Task<IEnumerable<string>> SetMembersAsync(string key, CancellationToken ct = default);
    Task<long> SetCardAsync(string key, CancellationToken ct = default);

    Task<long> SetCountUnionAsync(IReadOnlyCollection<string> keys, CancellationToken ct = default);

    Task<Dictionary<string, DateTime?>> GetManyHeartbeatsAsync(IReadOnlyCollection<string> keys, CancellationToken ct = default);
}
