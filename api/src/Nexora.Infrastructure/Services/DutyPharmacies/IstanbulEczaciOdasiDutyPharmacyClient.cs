using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Nexora.Application.Configuration;
using Nexora.Application.Features.DutyPharmacies;

namespace Nexora.Infrastructure.Services.DutyPharmacies;

public class IstanbulEczaciOdasiDutyPharmacyClient(
    IOptionsMonitor<PharmacySettings> settings,
    ILogger<IstanbulEczaciOdasiDutyPharmacyClient> logger) : IDutyPharmacySyncClient
{
    private static readonly Regex HiddenTokenRegex = new("""id="h"\s+value="([^"]*)"\s*/?>""", RegexOptions.Compiled);

    private string BaseUrl => settings.CurrentValue.BaseUrl;
    private string District => settings.CurrentValue.District;

    public async Task<IReadOnlyList<DutyPharmacySyncItem>> FetchSultangaziAsync(CancellationToken ct)
    {
        var handler = new HttpClientHandler
        {
            CookieContainer = new CookieContainer(),
            UseCookies = true,
        };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(settings.CurrentValue.TimeoutSeconds) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "Mozilla/5.0 (compatible; NexoraDutyPharmacySync/1.0; +https://www.bakirkoy.bel.tr)");

        var pageHtml = await client.GetStringAsync(BaseUrl, ct);
        var tokenMatch = HiddenTokenRegex.Match(pageHtml);
        if (!tokenMatch.Success)
        {
            logger.LogWarning("Nöbetçi eczane sayfasında 'h' token bulunamadı — sayfa yapısı değişmiş olabilir.");
            return [];
        }
        var token = tokenMatch.Groups[1].Value;

        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["jx"] = "1",
            ["islem"] = "get_ilce_eczane",
            ["ilce"] = District,
            ["h"] = token,
        });
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}index.php") { Content = form };
        request.Headers.Referrer = new Uri(BaseUrl);
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");

        using var response = await client.SendAsync(request, ct);
        var body = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Nöbetçi eczane servisi HTTP {Status} döndürdü: {Body}", (int)response.StatusCode, Truncate(body));
            return [];
        }

        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        if (!root.TryGetProperty("error", out var errorEl) || errorEl.GetInt32() != 0)
        {
            var message = root.TryGetProperty("message", out var m) ? m.GetString() : null;
            logger.LogWarning("Nöbetçi eczane servisi hata döndürdü: {Message}", message);
            return [];
        }

        if (!root.TryGetProperty("eczaneler", out var listEl) || listEl.ValueKind != JsonValueKind.Array)
            return [];

        var items = new List<DutyPharmacySyncItem>();
        foreach (var e in listEl.EnumerateArray())
        {
            var sicil = GetLong(e, "sicil");
            if (sicil is null) continue;

            items.Add(new DutyPharmacySyncItem(
                sicil.Value,
                GetString(e, "eczane_ad") ?? "",
                GetString(e, "eczane_tel"),
                StripHtml(GetString(e, "tarif")),
                StripHtml(GetString(e, "adres")),
                null,
                GetDouble(e, "lat"),
                GetDouble(e, "lng"),
                GetString(e, "nobet_bitis")));
        }
        return items;
    }

    private static long? GetLong(JsonElement e, string prop)
    {
        if (!e.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetInt64(),
            JsonValueKind.String when long.TryParse(v.GetString(), out var parsed) => parsed,
            _ => null,
        };
    }

    private static double? GetDouble(JsonElement e, string prop)
    {
        if (!e.TryGetProperty(prop, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.Number => v.GetDouble(),
            JsonValueKind.String when double.TryParse(v.GetString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => null,
        };
    }

    private static string? GetString(JsonElement e, string prop)
        => e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static string? StripHtml(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var text = Regex.Replace(html, "<[^>]+>", " ");
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"\s+", " ").Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static string Truncate(string s) => s.Length > 300 ? s[..300] : s;
}
