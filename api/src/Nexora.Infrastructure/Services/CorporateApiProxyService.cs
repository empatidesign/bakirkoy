using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.CorporateProxy;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// ICorporateApiProxyService implementasyonu. bkz. arayüz dokümantasyonu ve
/// GUVENLIK-YOL-HARITASI.md madde 2.
///
/// Token yönetimi: kurumsal API'nin auth/token ucu dakikada ~5 istekle
/// sınırlı (canlıda ölçüldü, pencere ~6sn) ve token 24 saat geçerli. Bu
/// yüzden token Redis'te cache'lenir — madde 4'te öğrenilen dersle aynı
/// nedenle (çoklu Nexora instance'ı process-içi cache kullansa her instance
/// ayrı token isteği atar ve limiti hızla tüketir). Redis yoksa (yerel
/// geliştirme) IMemoryCache'e düşülür; tek instance'lı ortamda bu yeterlidir.
/// </summary>
public sealed class CorporateApiProxyService : ICorporateApiProxyService
{
    private const string TokenCacheKey = "corporate-api:access-token";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IRedisService? _redis;
    private readonly IMemoryCache? _memoryCache;
    private readonly ILogger<CorporateApiProxyService> _logger;
    private readonly string _baseUrl;
    private readonly string _clientId;
    private readonly string _clientSecret;

    public CorporateApiProxyService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<CorporateApiProxyService> logger,
        IRedisService? redis = null,
        IMemoryCache? memoryCache = null)
    {
        _httpClientFactory = httpClientFactory;
        _redis = redis;
        _memoryCache = memoryCache;
        _logger = logger;

        var section = configuration.GetSection("CorporateApi");
        _baseUrl = section["BaseUrl"]?.TrimEnd('/') ?? "https://sultangazi.bel.tr/api/v2";
        _clientId = section["ClientId"] ?? "";
        _clientSecret = section["ClientSecret"] ?? "";
    }

    public async Task<CorporateApiResult> GetAsync(string path, string? queryString, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(_clientId) || string.IsNullOrEmpty(_clientSecret))
        {
            _logger.LogError("CorporateApi:ClientId/ClientSecret yapılandırılmamış.");
            return new CorporateApiResult(500, null, null);
        }

        var token = await GetOrRefreshTokenAsync(forceRefresh: false, ct);
        if (token is null)
            return new CorporateApiResult(502, null, null);

        var url = $"{_baseUrl}/{path}{(string.IsNullOrEmpty(queryString) ? "" : "?" + queryString)}";
        var client = _httpClientFactory.CreateClient("corporate-api");

        var response = await SendWithTokenAsync(client, url, token, ct);

        // 401: token DB'de/servis tarafında iptal edilmiş ya da beklenenden
        // erken geçersiz kılınmış olabilir — bir kez zorla yenileyip tekrar dene.
        if (response.StatusCode == 401)
        {
            var freshToken = await GetOrRefreshTokenAsync(forceRefresh: true, ct);
            if (freshToken is not null)
                response = await SendWithTokenAsync(client, url, freshToken, ct);
        }

        return response;
    }

    private async Task<CorporateApiResult> SendWithTokenAsync(HttpClient client, string url, string token, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        req.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));

        using var res = await client.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        return new CorporateApiResult((int)res.StatusCode, body, res.Content.Headers.ContentType?.MediaType);
    }

    /// <summary>
    /// Geçerli token'ı cache'ten okur; yoksa/forceRefresh ise yeni token alır.
    /// Aynı anda birden çok isteğin auth/token'a paralel gitmesini (thundering
    /// herd, rate limiti tüketir) engellemek için basit bir kilit kullanılır.
    /// </summary>
    private static readonly SemaphoreSlim TokenLock = new(1, 1);

    private async Task<string?> GetOrRefreshTokenAsync(bool forceRefresh, CancellationToken ct)
    {
        if (!forceRefresh)
        {
            var cached = await ReadCachedTokenAsync(ct);
            if (cached is not null) return cached;
        }

        await TokenLock.WaitAsync(ct);
        try
        {
            if (!forceRefresh)
            {
                // Kilidi beklerken başka bir istek zaten yenilemiş olabilir.
                var cached = await ReadCachedTokenAsync(ct);
                if (cached is not null) return cached;
            }

            return await RequestNewTokenAsync(ct);
        }
        finally
        {
            TokenLock.Release();
        }
    }

    private async Task<string?> ReadCachedTokenAsync(CancellationToken ct)
    {
        if (_redis is not null)
            return await _redis.GetAsync<string>(TokenCacheKey, ct);

        if (_memoryCache is not null && _memoryCache.TryGetValue(TokenCacheKey, out string? token))
            return token;

        return null;
    }

    private async Task<string?> RequestNewTokenAsync(CancellationToken ct)
    {
        var client = _httpClientFactory.CreateClient("corporate-api");

        // Kurumsal API'nin auth/token ucu bazen düzgün 429 yerine bağlantıyı
        // sıfırlıyor (canlıda gözlemlendi — bkz. mobil taraftaki
        // belediye.service.ts requestClientToken). Aynı savunmayı burada da
        // uyguluyoruz: 429/ağ hatasında kısa bekleyişle 2 kez daha dene.
        for (var attempt = 0; attempt <= 2; attempt++)
        {
            if (attempt > 0)
                await Task.Delay(TimeSpan.FromSeconds(3 * attempt), ct);

            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/auth/token")
                {
                    Content = JsonContent.Create(new { client_id = _clientId, client_secret = _clientSecret }),
                };
                using var res = await client.SendAsync(req, ct);

                if (res.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                    continue;

                if (!res.IsSuccessStatusCode)
                {
                    _logger.LogError("Kurumsal API token alınamadı: HTTP {Status}", (int)res.StatusCode);
                    return null;
                }

                var json = await res.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
                var data = json.GetProperty("data");
                var accessToken = data.GetProperty("accessToken").GetString();
                var expiresIn = data.TryGetProperty("expiresIn", out var e) ? e.GetInt32() : 3600;

                if (string.IsNullOrEmpty(accessToken)) return null;

                // 5 dakikalık pay: cache süresi dolmadan hemen önce alınan bir
                // istek, sunucuya varana kadar token'ın geçersizleşmesini önler.
                var ttl = TimeSpan.FromSeconds(Math.Max(60, expiresIn - 300));
                await CacheTokenAsync(accessToken, ttl, ct);

                return accessToken;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "Kurumsal API token isteği ağ hatası (deneme {Attempt})", attempt + 1);
            }
        }

        _logger.LogError("Kurumsal API token alınamadı: tüm denemeler tükendi.");
        return null;
    }

    private async Task CacheTokenAsync(string token, TimeSpan ttl, CancellationToken ct)
    {
        if (_redis is not null)
        {
            await _redis.SetAsync(TokenCacheKey, token, ttl, ct);
            return;
        }

        _memoryCache?.Set(TokenCacheKey, token, ttl);
    }
}
