using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Integrations;
using Nexora.Application.Features.Integrations.Dtos;
using Nexora.Infrastructure.Http;

namespace Nexora.Api.Endpoints.Integrations;

public static class IntegrationSettingsEndpoints
{
    public static IEndpointRouteBuilder MapIntegrationSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/v1/integration-settings")
            .WithTags("IntegrationSettings")
            .RequireAuthorization("AdminOrAbove");

        admin.MapGet("/", GetAdmin).RequirePermission("quick-settings.view");
        admin.MapPut("/", Save).RequirePermission("quick-settings.edit");
        admin.MapPost("/ulakbel/test", TestUlakbel).RequirePermission("quick-settings.edit");
        admin.MapPost("/flexcity/test", TestFlexcity).RequirePermission("quick-settings.edit");
        admin.MapPost("/bridge360/test", TestBridge360).RequirePermission("quick-settings.edit");

        admin.MapGet("/map-config", GetPublicMapConfig);

        var citizen = app.MapGroup("/api/v1/me/integration-settings")
            .WithTags("IntegrationSettings")
            .RequireAuthorization("Citizen");

        citizen.MapGet("/map-config", GetPublicMapConfig);

        var company = app.MapGroup("/api/v1/company/me/integration-settings")
            .WithTags("IntegrationSettings")
            .RequireAuthorization("Company");

        company.MapGet("/map-config", GetPublicMapConfig);

        var publicGroup = app.MapGroup("/api/v1/public/integration-settings")
            .WithTags("IntegrationSettings");

        publicGroup.MapGet("/map-config", GetPublicMapConfig).AllowAnonymous();

        return app;
    }

    private static async Task<IResult> GetAdmin(IIntegrationSettingsService service, CancellationToken ct)
    {
        var result = await service.GetAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Save(UpdateIntegrationSettingsRequest req, IIntegrationSettingsService service, CancellationToken ct)
    {
        var result = await service.SaveAsync(req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetPublicMapConfig(IIntegrationSettingsService service, CancellationToken ct)
    {
        var result = await service.GetPublicMapConfigAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    // Flexcity bağlantı testi: kaydedilmiş ayarlarla gerçek sorgu atılır. TC verilirse o kişinin
    // gecikmiş kitap sayısı da döner (TC yanıtta tekrar gösterilmez).
    private static async Task<IResult> TestFlexcity(FlexcityTestRequest? req, Nexora.Application.Features.Libraries.IEmanetService emanet, CancellationToken ct)
    {
        var before = await emanet.GetStatusAsync(ct);
        if (!before.Configured)
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = "Flexcity kapalı ya da adres/uygulama anahtarı girilmemiş. Önce etkinleştirip kaydedin." }));
        var tc = string.IsNullOrWhiteSpace(req?.Tckn) ? "11111111110" : req!.Tckn!.Trim();
        var result = await emanet.GetOverdueAsync(tc, ct);
        var after = await emanet.GetStatusAsync(ct);
        var ok = after.LastSuccessAt.HasValue && (!after.LastErrorAt.HasValue || after.LastSuccessAt >= after.LastErrorAt);
        return Results.Ok(ApiResponse.Ok(new
        {
            reachable = ok,
            message = ok
                ? (string.IsNullOrWhiteSpace(req?.Tckn)
                    ? "Flexcity'ye bağlanıldı, sorgu başarılı."
                    : $"Flexcity'ye bağlanıldı. Bu kişinin iade tarihi geçmiş {result.Count} kitabı var.")
                : $"Flexcity'ye bağlanılamadı: {after.LastError}",
        }));
    }

    public record FlexcityTestRequest(string? Tckn);

    private static async Task<IResult> TestUlakbel(IIntegrationSettingsService service, IHttpClientFactory httpClientFactory, CancellationToken ct)
    {
        var config = await service.ResolveUlakbelAsync(ct);
        if (config is null)
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = "Ulakbell yapılandırılmamış (etkin değil veya token eksik)." }));

        // SSRF koruması: BaseUrl admin tarafından girilebilen serbest bir metin alanı.
        // Sunucu tarafında bu adrese istek atmadan önce şema (yalnızca https) ve hedef
        // adresin özel/loopback/link-local (iç ağ, cloud metadata endpoint'i vb.) bir IP'ye
        // çözülmediğini doğrula. 2026-07-30 denetiminde bu kontrolün hiç olmadığı,
        // quick-settings.edit yetkisine sahip (superadmin olmayan) bir kullanıcının bu
        // endpoint üzerinden sunucudan rastgele iç ağ isteği attırabildiği tespit edildi.
        if (!OutboundUrlGuard.TryValidate(config.BaseUrl, out var validationError))
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = validationError }));

        try
        {
            var client = httpClientFactory.CreateClient("ulakbel");
            client.Timeout = TimeSpan.FromSeconds(8);
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", config.ApiToken);
            using var response = await client.GetAsync(config.BaseUrl, ct);
            return Results.Ok(ApiResponse.Ok(new
            {
                reachable = true,
                statusCode = (int)response.StatusCode,
                message = response.IsSuccessStatusCode
                    ? "Ulakbell sunucusuna ulaşıldı."
                    : $"Ulakbell sunucusu HTTP {(int)response.StatusCode} döndürdü (bu normal olabilir, önemli olan sunucunun yanıt vermesi).",
            }));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = $"Ulakbell sunucusuna ulaşılamadı: {ex.Message}" }));
        }
    }

    // Bridge360 bağlantı testi — Kullanıcı isteği (2026-10-07): Halk Masası mock modülünün
    // kaldırılmasıyla birlikte, ileride eklenecek Bridge360 çağrı merkezi entegrasyonu için
    // ayar ekranı hazırlandı. GERÇEK BRIDGE360 API DOKÜMANI/ŞEMASI HENÜZ SAĞLANMADI; bu yüzden
    // Ulakbell'deki /api/incident gibi bir gönderim şeması burada UYDURULMADI. Bu test yalnızca
    // kaydedilen adrese genel bir HTTP GET ile "sunucu yanıt veriyor mu" kontrolü yapar — Ulakbell
    // testindeki yaklaşımla aynı (gerçek entegrasyon endpoint'i bilinmediği için sunucunun ayakta
    // olduğunu doğrulamanın ötesine geçilemez). Gerçek API bilgileri geldiğinde bu test ve
    // IBridge360ForwardService ile değiştirilecektir.
    private static async Task<IResult> TestBridge360(IIntegrationSettingsService service, IHttpClientFactory httpClientFactory, CancellationToken ct)
    {
        var config = await service.ResolveBridge360Async(ct);
        if (config is null)
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = "Bridge360 yapılandırılmamış (etkin değil veya API anahtarı eksik)." }));

        if (!OutboundUrlGuard.TryValidate(config.BaseUrl, out var validationError))
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = validationError }));

        try
        {
            var client = httpClientFactory.CreateClient("bridge360");
            client.Timeout = TimeSpan.FromSeconds(8);
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", config.ApiKey);
            using var response = await client.GetAsync(config.BaseUrl, ct);
            return Results.Ok(ApiResponse.Ok(new
            {
                reachable = true,
                statusCode = (int)response.StatusCode,
                message = response.IsSuccessStatusCode
                    ? "Bridge360 sunucusuna ulaşıldı. Not: gerçek API şeması henüz tanımlı değil, bu yalnızca genel bir erişim testidir."
                    : $"Bridge360 sunucusu HTTP {(int)response.StatusCode} döndürdü (bu normal olabilir, önemli olan sunucunun yanıt vermesi).",
            }));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return Results.Ok(ApiResponse.Ok(new { reachable = false, message = $"Bridge360 sunucusuna ulaşılamadı: {ex.Message}" }));
        }
    }

}
