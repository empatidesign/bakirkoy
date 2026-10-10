using System.Text.Json;
using Nexora.Application.Common.Interfaces;
using StackExchange.Redis;

namespace Nexora.Infrastructure.Services;

public class RedisService(IConnectionMultiplexer redis) : IRedisService
{
    private readonly IDatabase _db = redis.GetDatabase();

    private static readonly LuaScript IncrementWithExpiryScript = LuaScript.Prepare(
        "local c = redis.call('INCR', @key) " +
        "if c == 1 then redis.call('PEXPIRE', @key, @ttlMs) end " +
        "return c");

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>((string)value!);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value);
        if (expiry.HasValue)
            await _db.StringSetAsync(key, json, expiry.Value);
        else
            await _db.StringSetAsync(key, json);
    }

    public async Task<T?> GetDeleteAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetDeleteAsync(key);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>((string)value!);
    }

    public async Task RemoveAsync(string key, CancellationToken ct = default)
        => await _db.KeyDeleteAsync(key);

    public async Task<bool> TryConsumeAsync(string key, CancellationToken ct = default)
        => await _db.KeyDeleteAsync(key);

    public async Task<bool> TrySetIfNotExistsAsync(string key, TimeSpan ttl, CancellationToken ct = default)
        => await _db.StringSetAsync(key, "1", ttl, When.NotExists);

    public async Task<string?> GetRawStringAsync(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key);
        return value.IsNullOrEmpty ? null : (string)value!;
    }

    private static readonly LuaScript CompareAndConsumeScript = LuaScript.Prepare(
        "local cur = redis.call('GET', @key) " +
        "if cur == false then return 0 end " +
        "if cur == @expected then redis.call('DEL', @key); return 1 end " +
        "return 0");

    public async Task<bool> CompareAndConsumeAsync(string key, string expected, CancellationToken ct = default)
    {
        var result = await _db.ScriptEvaluateAsync(CompareAndConsumeScript, new { key = (RedisKey)key, expected = (RedisValue)expected });
        return (long)result == 1;
    }

    public async Task<string?> TryAcquireLockAsync(string key, TimeSpan ttl, CancellationToken ct = default)
    {
        var token = Guid.NewGuid().ToString("N");
        var acquired = await _db.LockTakeAsync(key, token, ttl);
        return acquired ? token : null;
    }

    public async Task ReleaseLockAsync(string key, string token, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return;
        await _db.LockReleaseAsync(key, token);
    }

    private static readonly LuaScript RenewLockScript = LuaScript.Prepare(
        "if redis.call('GET', @key) == @token then return redis.call('PEXPIRE', @key, @ttlMs) else return 0 end");

    public async Task<bool> RenewLockAsync(string key, string token, TimeSpan ttl, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(token)) return false;
        var result = await _db.ScriptEvaluateAsync(RenewLockScript,
            new { key = (RedisKey)key, token = (RedisValue)token, ttlMs = (long)ttl.TotalMilliseconds });
        return (long)result == 1;
    }

    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
        => await _db.KeyExistsAsync(key);

    public async Task<int> GetTtlSecondsAsync(string key, CancellationToken ct = default)
    {
        var ttl = await _db.KeyTimeToLiveAsync(key);
        return ttl.HasValue ? (int)Math.Ceiling(ttl.Value.TotalSeconds) : 0;
    }

    public async Task<long> IncrementWithExpiryAsync(string key, TimeSpan expiry, CancellationToken ct = default)
    {
        var result = await _db.ScriptEvaluateAsync(
            IncrementWithExpiryScript,
            new { key = (RedisKey)key, ttlMs = (long)expiry.TotalMilliseconds });
        return (long)result;
    }

    public async Task SetAddAsync(string key, string value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        await _db.SetAddAsync(key, value);
        if (expiry.HasValue)
            await _db.KeyExpireAsync(key, expiry.Value);
    }

    public async Task SetAddPersistentAsync(string key, string value, CancellationToken ct = default)
    {
        await _db.SetAddAsync(key, value);
        await _db.KeyPersistAsync(key);
    }

    public async Task SetRemoveAsync(string key, string value, CancellationToken ct = default)
        => await _db.SetRemoveAsync(key, value);

    public async Task<IEnumerable<string>> SetMembersAsync(string key, CancellationToken ct = default)
    {
        var members = await _db.SetMembersAsync(key);
        return members.Select(m => m.ToString());
    }

    public async Task<long> SetCardAsync(string key, CancellationToken ct = default)
        => await _db.SetLengthAsync(key);

    public async Task<long> SetCountUnionAsync(IReadOnlyCollection<string> keys, CancellationToken ct = default)
    {
        if (keys.Count == 0) return 0;
        var redisKeys = keys.Select(k => (RedisKey)k).ToArray();
        var union = await _db.SetCombineAsync(SetOperation.Union, redisKeys);
        return union.Length;
    }

    public async Task<Dictionary<string, DateTime?>> GetManyHeartbeatsAsync(IReadOnlyCollection<string> keys, CancellationToken ct = default)
    {
        var result = new Dictionary<string, DateTime?>(keys.Count);
        if (keys.Count == 0) return result;

        var redisKeys = keys.Select(k => (RedisKey)k).ToArray();
        var values = await _db.StringGetAsync(redisKeys);

        var i = 0;
        foreach (var key in keys)
        {
            var value = values[i++];
            result[key] = value.IsNullOrEmpty ? null : JsonSerializer.Deserialize<DateTime?>((string)value!);
        }
        return result;
    }
}
