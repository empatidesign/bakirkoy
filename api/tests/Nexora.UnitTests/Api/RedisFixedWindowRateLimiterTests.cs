using System.Threading.RateLimiting;
using Nexora.Api.Common.RateLimiting;
using StackExchange.Redis;
using Xunit;

namespace Nexora.UnitTests.Api;

/// <summary>
/// 2026-09-07 denetimi: RateLimitPartition.GetFixedWindowLimiter'ın process-içi
/// sayacı, üç backend instance'ının aynı Redis'e karşı Yazdığı senaryoda
/// atlatılabiliyordu (bkz. Program.cs'teki açıklama). Bu testler yeni
/// RedisFixedWindowRateLimiter'ın gerçek Redis'e karşı, BİRDEN FAZLA "instance"ı
/// (her biri kendi RedisFixedWindowRateLimiter örneği, ama aynı Redis
/// bağlantısı/anahtarı) simüle ederek doğru limitlediğini kanıtlar.
///
/// Gereksinim: yerelde çalışan bir Redis (localhost:6379). CI ortamında yoksa
/// bu sınıftaki testler atlanır (bkz. RedisAvailableFact).
/// </summary>
public class RedisFixedWindowRateLimiterTests : IDisposable
{
    private readonly IConnectionMultiplexer? _redis;
    private readonly string _testKeyPrefix = $"test:{Guid.NewGuid():N}";

    public RedisFixedWindowRateLimiterTests()
    {
        try
        {
            _redis = ConnectionMultiplexer.Connect("localhost:6379,connectTimeout=1000,abortConnect=false");
            if (!_redis.IsConnected) _redis = null;
        }
        catch
        {
            _redis = null;
        }
    }

    public void Dispose()
    {
        if (_redis is null) return;
        var db = _redis.GetDatabase();
        var server = _redis.GetServer(_redis.GetEndPoints()[0]);
        foreach (var key in server.Keys(pattern: $"ratelimit:{_testKeyPrefix}*"))
            db.KeyDelete(key);
        _redis.Dispose();
    }

    [Fact]
    public void TekInstance_LimitiAsanIstek_Reddedilir()
    {
        if (_redis is null) throw new InvalidOperationException("Yerel Redis bulunamadı (localhost:6379). Test için Redis gerekli.");

        var limiter = new RedisFixedWindowRateLimiter(_redis!, $"{_testKeyPrefix}:single", permitLimit: 3, TimeSpan.FromSeconds(5));

        Assert.True(limiter.AttemptAcquire(1).IsAcquired, "1. istek kabul edilmeli");
        Assert.True(limiter.AttemptAcquire(1).IsAcquired, "2. istek kabul edilmeli");
        Assert.True(limiter.AttemptAcquire(1).IsAcquired, "3. istek kabul edilmeli");
        Assert.False(limiter.AttemptAcquire(1).IsAcquired, "4. istek REDDEDILMELI (limit=3)");
    }

    [Fact]
    public void UcAyriInstance_AyniPartitionKey_TopluLimitiPaylasir()
    {
        // Bu, canlıda bulunan gerçek kusuru simüle eder: nginx-lb.conf'taki
        // 3 backend instance'ı, aynı client IP için 3 AYRI RateLimiter nesnesi
        // oluşturur (her HTTP isteği kendi process'inde limiter kurar). Eski
        // (in-memory) implementasyonda bu üç nesne birbirinden habersizdi ve
        // limit etkin şekilde 3 katına çıkıyordu. Redis tabanlı versiyonda
        // aynı anahtara yazdıkları için toplam sayaç PAYLAŞILMALI.
        if (_redis is null) throw new InvalidOperationException("Yerel Redis bulunamadı (localhost:6379). Test için Redis gerekli.");

        var partitionKey = $"{_testKeyPrefix}:multi";
        var instance1 = new RedisFixedWindowRateLimiter(_redis!, partitionKey, permitLimit: 5, TimeSpan.FromSeconds(5));
        var instance2 = new RedisFixedWindowRateLimiter(_redis!, partitionKey, permitLimit: 5, TimeSpan.FromSeconds(5));
        var instance3 = new RedisFixedWindowRateLimiter(_redis!, partitionKey, permitLimit: 5, TimeSpan.FromSeconds(5));

        // "Client" istekleri sırayla farklı instance'lara (least_conn benzeri) düşüyor.
        var results = new List<bool>();
        var roundRobin = new RateLimiter[] { instance1, instance2, instance3 };
        for (var i = 0; i < 8; i++)
        {
            var limiter = roundRobin[i % 3];
            results.Add(limiter.AttemptAcquire(1).IsAcquired);
        }

        // limit=5 olduğu için ilk 5 istek (hangi instance'a düşerse düşsün) kabul,
        // sonraki 3'ü reddedilmeli. Eski in-memory implementasyonda her instance
        // kendi 5'ini sayardı ve 8 istek de kabul edilirdi.
        Assert.Equal(5, results.Count(r => r));
        Assert.Equal(3, results.Count(r => !r));
    }

    [Fact]
    public void PencereSuresiSonunda_SayacSifirlanir()
    {
        if (_redis is null) throw new InvalidOperationException("Yerel Redis bulunamadı (localhost:6379). Test için Redis gerekli.");

        var limiter = new RedisFixedWindowRateLimiter(_redis!, $"{_testKeyPrefix}:window", permitLimit: 2, TimeSpan.FromSeconds(2));

        Assert.True(limiter.AttemptAcquire(1).IsAcquired);
        Assert.True(limiter.AttemptAcquire(1).IsAcquired);
        Assert.False(limiter.AttemptAcquire(1).IsAcquired, "Pencere dolmadan 3. istek reddedilmeli");

        Thread.Sleep(2200);

        Assert.True(limiter.AttemptAcquire(1).IsAcquired, "Pencere sıfırlandıktan sonra tekrar kabul edilmeli");
    }

    [Fact]
    public void RetryAfter_MetadataOlarakDoner()
    {
        if (_redis is null) throw new InvalidOperationException("Yerel Redis bulunamadı (localhost:6379). Test için Redis gerekli.");

        var limiter = new RedisFixedWindowRateLimiter(_redis!, $"{_testKeyPrefix}:retryafter", permitLimit: 1, TimeSpan.FromSeconds(10));

        limiter.AttemptAcquire(1);
        var rejected = limiter.AttemptAcquire(1);

        Assert.False(rejected.IsAcquired);
        Assert.True(rejected.TryGetMetadata(MetadataName.RetryAfter.Name, out var retryAfter));
        Assert.IsType<TimeSpan>(retryAfter);
        Assert.True((TimeSpan)retryAfter! > TimeSpan.Zero);
    }
}
