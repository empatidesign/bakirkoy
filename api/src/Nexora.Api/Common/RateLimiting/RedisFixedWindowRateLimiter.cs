using System.Threading.RateLimiting;
using StackExchange.Redis;

namespace Nexora.Api.Common.RateLimiting;

public sealed class RedisFixedWindowRateLimiter : RateLimiter
{
    private static readonly LuaScript IncrementScript = LuaScript.Prepare(
        "local c = redis.call('INCR', @key) " +
        "local ttl = redis.call('PTTL', @key) " +
        "if c == 1 or ttl < 0 then redis.call('PEXPIRE', @key, @windowMs) ttl = @windowMs end " +
        "return { c, ttl }");

    private readonly IConnectionMultiplexer _redis;
    private readonly RedisKey _key;
    private readonly int _permitLimit;
    private readonly TimeSpan _window;
    private long _lastUsedTicks;

    public RedisFixedWindowRateLimiter(
        IConnectionMultiplexer redis,
        string partitionKey,
        int permitLimit,
        TimeSpan window)
    {
        _redis = redis;
        _key = $"ratelimit:{partitionKey}";
        _permitLimit = permitLimit;
        _window = window;
        _lastUsedTicks = DateTime.UtcNow.Ticks;
    }

    public override TimeSpan? IdleDuration =>
        TimeSpan.FromTicks(Math.Max(0, DateTime.UtcNow.Ticks - Interlocked.Read(ref _lastUsedTicks)));

    protected override RateLimitLease AttemptAcquireCore(int permitCount)
    {
        Interlocked.Exchange(ref _lastUsedTicks, DateTime.UtcNow.Ticks);
        var db = _redis.GetDatabase();
        var result = db.ScriptEvaluate(IncrementScript, new { key = _key, windowMs = (long)_window.TotalMilliseconds });
        return BuildLease(result);
    }

    protected override async ValueTask<RateLimitLease> AcquireAsyncCore(int permitCount, CancellationToken cancellationToken)
    {
        Interlocked.Exchange(ref _lastUsedTicks, DateTime.UtcNow.Ticks);
        var db = _redis.GetDatabase();
        var result = await db.ScriptEvaluateAsync(IncrementScript, new { key = _key, windowMs = (long)_window.TotalMilliseconds });
        return BuildLease(result);
    }

    private RateLimitLease BuildLease(RedisResult result)
    {
        var values = (RedisValue[]?)result;
        if (values is not { Length: >= 1 })
            return new RedisRateLimitLease(true, null);

        var count = (long)values[0];
        var ttlMs = values.Length >= 2 ? (long)values[1] : (long)_window.TotalMilliseconds;

        if (count > _permitLimit)
        {
            var retryAfter = ttlMs > 0 ? TimeSpan.FromMilliseconds(ttlMs) : _window;
            return new RedisRateLimitLease(false, retryAfter);
        }

        return new RedisRateLimitLease(true, null);
    }

    public override RateLimiterStatistics? GetStatistics() => null;

    private sealed class RedisRateLimitLease(bool acquired, TimeSpan? retryAfter) : RateLimitLease
    {
        public override bool IsAcquired => acquired;

        public override IEnumerable<string> MetadataNames =>
            retryAfter.HasValue ? [MetadataName.RetryAfter.Name] : [];

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            if (metadataName == MetadataName.RetryAfter.Name && retryAfter.HasValue)
            {
                metadata = retryAfter.Value;
                return true;
            }
            metadata = null;
            return false;
        }
    }
}
