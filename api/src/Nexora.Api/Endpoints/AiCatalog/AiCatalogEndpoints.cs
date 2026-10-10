using Microsoft.Extensions.Caching.Memory;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.AiCatalog;
using Nexora.Application.Features.AiCatalog.Dtos;

namespace Nexora.Api.Endpoints.AiCatalog;

/// <summary>
/// Kullanıcı isteği: dış bir yapay zeka asistanının belediyenin tüm modüllerindeki
/// (kütüphane, spor/kurs/program, salon, gezi, acil toplanma alanı, hizmet tesisi)
/// verilere "hangi program nerede var, nerede boşluk var" gibi sorularla erişebilmesi.
///
/// Bu grup KASITLI OLARAK sadece GET (salt-okunur) endpoint içerir — hiçbir kayıt,
/// başvuru veya iptal işlemi buradan yapılamaz (bkz. IAiCatalogService, hiçbir
/// write metodu yok). Var olan /api/v1/public grubuyla aynı X-Api-Key korumasını
/// (PublicApiKeyFilter, config: PublicApi:Enabled / PublicApi:RequireApiKey /
/// PublicApi:ApiKeys) kullanır.
/// </summary>
public static class AiCatalogEndpoints
{
    public static IEndpointRouteBuilder MapAiCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public/ai-catalog")
            .WithTags("AiCatalog")
            .AddEndpointFilter<PublicApiKeyFilter>();

        group.MapGet("/summary", async (
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var data = await CacheGet(cache, cfg, "ai:summary", () => svc.GetSummaryAsync(ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/programs", async (
            string? q, string? module, string? district, bool? onlyAvailable, int? limit,
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var p = new AiCatalogSearchParams(q, module, district, onlyAvailable, limit ?? 100);
            var key = $"ai:programs:{q}:{module}:{district}:{onlyAvailable}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.SearchProgramsAsync(p, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/libraries", async (
            string? q, string? district, bool? onlyAvailable, int? limit,
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var p = new AiCatalogSearchParams(q, District: district, OnlyAvailable: onlyAvailable, Limit: limit ?? 100);
            var key = $"ai:libraries:{q}:{district}:{onlyAvailable}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.SearchLibrariesAsync(p, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/halls", async (
            string? q, int? limit,
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var p = new AiCatalogSearchParams(q, Limit: limit ?? 100);
            var key = $"ai:halls:{q}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.SearchHallsAsync(p, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/travels", async (
            string? q, bool? onlyAvailable, int? limit,
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var p = new AiCatalogSearchParams(q, OnlyAvailable: onlyAvailable, Limit: limit ?? 100);
            var key = $"ai:travels:{q}:{onlyAvailable}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.SearchTravelsAsync(p, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/emergency-areas", async (
            string? q, string? district, int? limit,
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var p = new AiCatalogSearchParams(q, District: district, Limit: limit ?? 100);
            var key = $"ai:emergency:{q}:{district}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.SearchEmergencyAreasAsync(p, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/facilities", async (
            string? q, string? district, int? limit,
            IAiCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var p = new AiCatalogSearchParams(q, District: district, Limit: limit ?? 100);
            var key = $"ai:facilities:{q}:{district}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.SearchFacilitiesAsync(p, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        return app;
    }

    private static async Task<T> CacheGet<T>(IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, string key, Func<Task<T>> factory)
    {
        if (cache.TryGetValue(key, out T? cached) && cached is not null) return cached;
        var value = await factory();
        var seconds = cfg.GetValue("PublicApi:CacheSeconds", 60);
        if (seconds > 0)
            cache.Set(key, value, TimeSpan.FromSeconds(seconds));
        return value;
    }
}
