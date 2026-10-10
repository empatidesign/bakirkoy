using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Configuration;
using Nexora.Application.Features.EmergencyAreas;

namespace Nexora.Infrastructure.Services.EmergencyAreas;

/// Netcad GIS API istemcisi: POST /gisapi/authentication/login → sessionid,
/// ardından GET /gisapi/query/GeoJSON?QueryName=..&amp;sessionid=..&amp;startReadIndex=..&amp;pageCount=.. ile sayfalı okuma.
/// Session süresi dolabildiği için her senkronizasyonda yeni oturum açılır; 401/403 alınırsa bir kez yeniden login olunur.
public class AfadGisClient(
    HttpClient http,
    IOptionsMonitor<AfadGisSettings> options,
    ILogger<AfadGisClient> logger) : IAfadGisClient
{
    private const int MaxPages = 200; // sonsuz döngü emniyeti

    public async Task<IReadOnlyList<AfadGisAreaItem>> FetchAllAsync(CancellationToken ct)
    {
        var s = options.CurrentValue;
        if (!s.IsConfigured)
            throw new InvalidOperationException("AFAD GIS entegrasyonu yapılandırılmamış (AfadGis:Enabled/BaseUrl/UserName).");

        var baseUrl = s.BaseUrl.TrimEnd('/');
        var converter = AfadCoordinateConverter.From(s);
        var pageSize = Math.Clamp(s.PageSize, 1, 5000);
        var sessionId = await LoginAsync(baseUrl, s, ct);

        var all = new Dictionary<long, AfadGisAreaItem>();
        var start = 0;
        for (var page = 0; page < MaxPages; page++)
        {
            string body;
            try
            {
                body = await QueryAsync(baseUrl, s.QueryName, sessionId, start, pageSize, ct);
            }
            catch (UnauthorizedAccessException)
            {
                logger.LogInformation("AFAD GIS oturumu geçersiz, yeniden giriş yapılıyor.");
                sessionId = await LoginAsync(baseUrl, s, ct);
                try
                {
                    body = await QueryAsync(baseUrl, s.QueryName, sessionId, start, pageSize, ct);
                }
                catch (UnauthorizedAccessException)
                {
                    throw new InvalidOperationException(
                        $"AFAD GIS sorgusu yetkisiz (HTTP 401): '{s.UserName}' kullanıcısı login olabiliyor ancak '{s.QueryName}' sorgusuna erişim yetkisi yok veya servis bu ağdan erişime kapalı.");
                }
            }

            var parsed = AfadGisGeoJsonParser.Parse(body, converter);
            foreach (var item in parsed.Items) all[item.ObjectId] = item;

            start += parsed.RawCount;
            var done = parsed.RawCount == 0
                || parsed.RawCount < pageSize
                || (parsed.TotalRowCount is int total && start >= total);
            if (done) break;
        }

        logger.LogInformation("AFAD GIS servisinden {Count} toplanma alanı okundu.", all.Count);
        return all.Values.ToList();
    }

    private async Task<string> LoginAsync(string baseUrl, AfadGisSettings s, CancellationToken ct)
    {
        using var res = await http.PostAsJsonAsync($"{baseUrl}/gisapi/authentication/login",
            new { userName = s.UserName, password = s.Password }, ct);
        var body = await res.Content.ReadAsStringAsync(ct);
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"AFAD GIS login HTTP {(int)res.StatusCode}: {Truncate(body)}", null, res.StatusCode);

        try
        {
            using var doc = JsonDocument.Parse(body);
            foreach (var p in doc.RootElement.EnumerateObject())
                if (string.Equals(p.Name, "sessionid", StringComparison.OrdinalIgnoreCase)
                    && p.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(p.Value.GetString()))
                    return p.Value.GetString()!;
        }
        catch (JsonException) { }

        throw new InvalidOperationException("AFAD GIS login yanıtında sessionid bulunamadı (kullanıcı adı/şifre hatalı olabilir).");
    }

    private async Task<string> QueryAsync(string baseUrl, string queryName, string sessionId, int start, int pageCount, CancellationToken ct)
    {
        var url = $"{baseUrl}/gisapi/query/GeoJSON?QueryName={Uri.EscapeDataString(queryName)}"
            + $"&sessionid={Uri.EscapeDataString(sessionId)}&startReadIndex={start}&pageCount={pageCount}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Accept.ParseAdd("application/json");
        using var res = await http.SendAsync(req, ct);
        var body = await res.Content.ReadAsStringAsync(ct);

        if (res.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw new UnauthorizedAccessException();
        if (!res.IsSuccessStatusCode)
            throw new HttpRequestException($"AFAD GIS sorgu HTTP {(int)res.StatusCode}: {Truncate(body)}", null, res.StatusCode);

        var trimmed = body.TrimStart();
        if (!trimmed.StartsWith('{'))
        {
            // Bazı Netcad sürümleri geçersiz oturumda 200 + düz metin/HTML döndürür.
            if (trimmed.Contains("session", StringComparison.OrdinalIgnoreCase) || trimmed.Contains("oturum", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException();
            throw new InvalidOperationException($"AFAD GIS sorgusu JSON dışı yanıt döndü: {Truncate(body)}");
        }
        return body;
    }

    private static string Truncate(string s) => s.Length > 300 ? s[..300] : s;
}
