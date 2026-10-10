using Microsoft.Extensions.Caching.Memory;
using Nexora.Application.Common.Interfaces;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.UnitTests.Infrastructure;

// Kullanıcı isteği (2026-09-07): giriş yapmış kullanıcılar 5 dakikalık pencerede
// online sayılsın, sistem performansı bozulmasın, toplam online sayısı görülsün.
public class OnlineUserTrackerTests
{
    /// <summary>Testte gerçek Redis yerine kullanılan, komutları sayan sahte servis.</summary>
    private sealed class FakeRedis : IRedisService
    {
        public readonly Dictionary<string, HashSet<string>> Sets = [];
        public int SetAddCalls;

        public Task SetAddAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default)
        {
            SetAddCalls++;
            if (!Sets.TryGetValue(key, out var set)) Sets[key] = set = [];
            set.Add(value);
            return Task.CompletedTask;
        }

        public Task<long> SetCountUnionAsync(IReadOnlyCollection<string> keys, CancellationToken ct = default)
        {
            var union = new HashSet<string>();
            foreach (var k in keys)
                if (Sets.TryGetValue(k, out var set)) union.UnionWith(set);
            return Task.FromResult((long)union.Count);
        }

        // Kullanılmayan üyeler
        public Task<T?> GetAsync<T>(string key, CancellationToken ct = default) => Task.FromResult<T?>(default);
        public Task<T?> GetDeleteAsync<T>(string key, CancellationToken ct = default) => Task.FromResult<T?>(default);
        public Task<long> IncrementWithExpiryAsync(string key, TimeSpan expiry, CancellationToken ct = default) => Task.FromResult(1L);
        public Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task RemoveAsync(string key, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> TryConsumeAsync(string key, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> TrySetIfNotExistsAsync(string key, TimeSpan ttl, CancellationToken ct = default) => Task.FromResult(true);
        public Task<string?> GetRawStringAsync(string key, CancellationToken ct = default) => Task.FromResult<string?>(null);
        public Task<bool> CompareAndConsumeAsync(string key, string expected, CancellationToken ct = default) => Task.FromResult(false);
        public Task<string?> TryAcquireLockAsync(string key, TimeSpan ttl, CancellationToken ct = default) => Task.FromResult<string?>("token");
        public Task ReleaseLockAsync(string key, string token, CancellationToken ct = default) => Task.CompletedTask;
        public Task<bool> RenewLockAsync(string key, string token, TimeSpan ttl, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ExistsAsync(string key, CancellationToken ct = default) => Task.FromResult(false);
        public Task<int> GetTtlSecondsAsync(string key, CancellationToken ct = default) => Task.FromResult(0);
        public Task SetRemoveAsync(string key, string value, CancellationToken ct = default) => Task.CompletedTask;
        public Task<IEnumerable<string>> SetMembersAsync(string key, CancellationToken ct = default) => Task.FromResult<IEnumerable<string>>([]);
        public Task<long> SetCardAsync(string key, CancellationToken ct = default) => Task.FromResult(0L);
        public Task<Dictionary<string, DateTime?>> GetManyHeartbeatsAsync(IReadOnlyCollection<string> keys, CancellationToken ct = default) => Task.FromResult(new Dictionary<string, DateTime?>());
    }

    private static (OnlineUserTracker Tracker, FakeRedis Redis) Build()
    {
        var redis = new FakeRedis();
        return (new OnlineUserTracker(redis, new MemoryCache(new MemoryCacheOptions())), redis);
    }

    [Fact]
    public async Task Giris_yapan_kullanici_online_sayilir()
    {
        var (tracker, _) = Build();
        await tracker.TouchAsync(Guid.NewGuid(), "admin");

        var snapshot = await tracker.GetSnapshotAsync();
        Assert.Equal(1, snapshot.Total);
        Assert.Equal(1, snapshot.Admin);
    }

    [Fact]
    public async Task Ayni_kullanici_iki_kez_sayilmaz()
    {
        var (tracker, _) = Build();
        var userId = Guid.NewGuid();
        await tracker.TouchAsync(userId, "citizen");
        await tracker.TouchAsync(userId, "citizen");

        var snapshot = await tracker.GetSnapshotAsync();
        Assert.Equal(1, snapshot.Total);
    }

    // Performans gereksinimi: her istekte Redis'e gidilmemeli.
    [Fact]
    public async Task Tekrarli_istekler_redise_gitmez()
    {
        var (tracker, redis) = Build();
        var userId = Guid.NewGuid();

        for (var i = 0; i < 100; i++)
            await tracker.TouchAsync(userId, "admin");

        Assert.Equal(1, redis.SetAddCalls);
    }

    [Fact]
    public async Task Kullanici_tipleri_ayri_ayri_sayilir()
    {
        var (tracker, _) = Build();
        await tracker.TouchAsync(Guid.NewGuid(), "admin");
        await tracker.TouchAsync(Guid.NewGuid(), "citizen");
        await tracker.TouchAsync(Guid.NewGuid(), "citizen");
        await tracker.TouchAsync(Guid.NewGuid(), "company");

        var s = await tracker.GetSnapshotAsync();
        Assert.Equal(4, s.Total);
        Assert.Equal(1, s.Admin);
        Assert.Equal(2, s.Citizen);
        Assert.Equal(1, s.Company);
    }

    // 5 dakikadan eski hareket online sayılmamalı: pencere dışındaki kova okunmaz.
    [Fact]
    public async Task Bes_dakikadan_eski_hareket_online_sayilmaz()
    {
        var (tracker, redis) = Build();
        var eskiKova = $"online:admin:{DateTime.UtcNow.AddMinutes(-10):yyyyMMddHHmm}";
        await redis.SetAddAsync(eskiKova, Guid.NewGuid().ToString());

        var snapshot = await tracker.GetSnapshotAsync();
        Assert.Equal(0, snapshot.Total);
    }

    [Fact]
    public async Task Hicbir_hareket_yoksa_sifir_doner()
    {
        var (tracker, _) = Build();
        Assert.Equal(0, (await tracker.GetSnapshotAsync()).Total);
    }

    [Fact]
    public async Task Redis_yoksa_takip_sessizce_devre_disi_kalir()
    {
        var tracker = new NullOnlineUserTracker();
        await tracker.TouchAsync(Guid.NewGuid(), "admin");
        Assert.Equal(0, (await tracker.GetSnapshotAsync()).Total);
    }

    // Kullanıcı isteği (2026-10-04): "mobil uygulamada kaç kişi online, kaçı iOS kaçı
    // Android" — vatandaş (citizen) kullanıcılar için platform kırılımı da takip edilir.
    [Fact]
    public async Task Vatandas_platform_kirilimi_ayri_sayilir()
    {
        var (tracker, _) = Build();
        await tracker.TouchAsync(Guid.NewGuid(), "citizen", "ios");
        await tracker.TouchAsync(Guid.NewGuid(), "citizen", "ios");
        await tracker.TouchAsync(Guid.NewGuid(), "citizen", "android");
        await tracker.TouchAsync(Guid.NewGuid(), "citizen", "web");
        await tracker.TouchAsync(Guid.NewGuid(), "citizen", null);

        var s = await tracker.GetSnapshotAsync();
        Assert.Equal(5, s.Citizen);
        Assert.Equal(2, s.CitizenIos);
        Assert.Equal(1, s.CitizenAndroid);
        Assert.Equal(2, s.CitizenWeb); // bilinmeyen/boş platform web sayılmalı
    }

    // Admin/firma kullanıcıları için platform kırılımı anlamsızdır (yalnız vatandaş
    // mobil uygulamasının platformu takip edilir) — bu tipler platform kovalarına hiç
    // yazmamalı, aksi halde kırılım toplamı yanlışlıkla şişer.
    [Fact]
    public async Task Admin_ve_firma_platform_kovasina_yazmaz()
    {
        var (tracker, _) = Build();
        await tracker.TouchAsync(Guid.NewGuid(), "admin", "ios");
        await tracker.TouchAsync(Guid.NewGuid(), "company", "android");

        var s = await tracker.GetSnapshotAsync();
        Assert.Equal(0, s.CitizenIos);
        Assert.Equal(0, s.CitizenAndroid);
        Assert.Equal(0, s.CitizenWeb);
    }

    [Fact]
    public async Task Ayni_vatandas_platformda_iki_kez_sayilmaz()
    {
        var (tracker, _) = Build();
        var userId = Guid.NewGuid();
        await tracker.TouchAsync(userId, "citizen", "ios");
        await tracker.TouchAsync(userId, "citizen", "ios");

        var s = await tracker.GetSnapshotAsync();
        Assert.Equal(1, s.Citizen);
        Assert.Equal(1, s.CitizenIos);
    }
}
