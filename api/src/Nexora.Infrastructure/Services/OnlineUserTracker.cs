using Microsoft.Extensions.Caching.Memory;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Redis dakika-kovası (bucket) yöntemiyle online kullanıcı takibi.
/// <para>
/// <b>Neden bu yöntem:</b> "her istekte DB'ye son görülme yaz" yaklaşımı yoğun
/// trafikte veritabanını kilitler. Burada her istek yalnızca Redis'e bir SADD
/// yapar; üstelik aynı kullanıcı aynı dakika içinde tekrar tekrar yazmasın diye
/// süreç içi bellekte (<see cref="IMemoryCache"/>) throttle edilir. Böylece
/// kullanıcı başına dakikada en fazla 1 Redis komutu çalışır.
/// </para>
/// <para>
/// <b>5 dakika penceresi:</b> son 5 dakikanın kovaları birleştirilerek benzersiz
/// kullanıcı sayısı bulunur. Kovalar <see cref="BucketTtl"/> sonunda kendiliğinden
/// silinir, ayrı bir temizlik işi gerekmez.
/// </para>
/// </summary>
public class OnlineUserTracker(IRedisService redis, IMemoryCache cache) : IOnlineUserTracker
{
    /// <summary>Online sayılmak için gereken hareketsizlik penceresi (kullanıcı isteği: 5 dakika).</summary>
    public const int WindowMinutes = 5;

    // Pencereden biraz uzun: kova, pencere kayarken hâlâ okunabilir olmalı.
    private static readonly TimeSpan BucketTtl = TimeSpan.FromMinutes(WindowMinutes + 1);

    // Aynı kullanıcı+dakika için tekrar Redis'e gitmemek adına kısa süreli yerel işaret.
    private static readonly TimeSpan TouchThrottle = TimeSpan.FromSeconds(55);

    private static readonly string[] UserTypes = ["admin", "citizen", "company"];
    private static readonly string[] CitizenPlatforms = ["ios", "android", "web"];

    public async Task TouchAsync(Guid userId, string userType, string? platform = null, CancellationToken ct = default)
    {
        var type = Normalize(userType);
        var bucket = BucketKey(type, DateTime.UtcNow);

        // Süreç içi throttle: bu kullanıcı bu dakika zaten işaretlendiyse Redis'e gitme.
        var throttleKey = $"online-touched:{bucket}:{userId}";
        if (cache.TryGetValue(throttleKey, out _)) return;
        cache.Set(throttleKey, true, TouchThrottle);

        await redis.SetAddAsync(bucket, userId.ToString(), BucketTtl, ct);

        // Kullanıcı isteği (2026-10-04): vatandaş (mobil uygulama) için ayrıca platform
        // bazında (iOS/Android/Web) ayrı bir kovaya da ekler — toplam sayım bundan
        // etkilenmez, yalnızca kırılım için ek bir SADD'dir.
        if (type == "citizen")
        {
            var normalizedPlatform = NormalizePlatform(platform);
            var platformBucket = PlatformBucketKey(normalizedPlatform, DateTime.UtcNow);
            await redis.SetAddAsync(platformBucket, userId.ToString(), BucketTtl, ct);
        }
    }

    public async Task<OnlineSnapshot> GetSnapshotAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var counts = new Dictionary<string, int>();

        foreach (var type in UserTypes)
        {
            var keys = Enumerable.Range(0, WindowMinutes)
                .Select(i => BucketKey(type, now.AddMinutes(-i)))
                .ToArray();
            counts[type] = (int)await redis.SetCountUnionAsync(keys, ct);
        }

        var platformCounts = new Dictionary<string, int>();
        foreach (var platform in CitizenPlatforms)
        {
            var keys = Enumerable.Range(0, WindowMinutes)
                .Select(i => PlatformBucketKey(platform, now.AddMinutes(-i)))
                .ToArray();
            platformCounts[platform] = (int)await redis.SetCountUnionAsync(keys, ct);
        }

        // Tipler arasında kullanıcı kimlikleri çakışmaz (farklı tablolar), toplam = tiplerin toplamı.
        var admin = counts["admin"];
        var citizen = counts["citizen"];
        var company = counts["company"];
        return new OnlineSnapshot(
            admin + citizen + company, admin, citizen, company,
            platformCounts["ios"], platformCounts["android"], platformCounts["web"]);
    }

    private static string Normalize(string? userType)
        => userType?.ToLowerInvariant() switch
        {
            "admin" => "admin",
            "citizen" => "citizen",
            "company" => "company",
            _ => "admin",
        };

    private static string NormalizePlatform(string? platform)
        => platform?.ToLowerInvariant() switch
        {
            "ios" => "ios",
            "android" => "android",
            _ => "web",
        };

    private static string BucketKey(string userType, DateTime utc)
        => $"online:{userType}:{utc:yyyyMMddHHmm}";

    private static string PlatformBucketKey(string platform, DateTime utc)
        => $"online:citizen:platform:{platform}:{utc:yyyyMMddHHmm}";
}
