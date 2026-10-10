using Microsoft.Extensions.Caching.Memory;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Public;

namespace Nexora.Api.Endpoints.Public;

public static class PublicCatalogEndpoints
{
    public static IEndpointRouteBuilder MapPublicCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public")
            .WithTags("Public")
            .AddEndpointFilter<PublicApiKeyFilter>();

        group.MapGet("/service-facilities", async (
            string? search, string? type, string? district, string? serviceModule, int? page, int? limit,
            IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var key = $"pub:facilities:{search}:{type}:{district}:{serviceModule}:{page}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.GetFacilitiesAsync(
                new PublicFacilityQuery(search, type, district, serviceModule, page ?? 1, limit ?? 50), ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/service-facilities/map-points", async (
            IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var data = await CacheGet(cache, cfg, "pub:facilities:map", () => svc.GetFacilityMapPointsAsync(ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/service-facilities/{id:guid}", async (
            Guid id, IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var data = await CacheGet(cache, cfg, $"pub:facility:{id}", () => svc.GetFacilityAsync(id, ct));
            return data is null ? Results.NotFound(ApiResponse.Fail(404, "Tesis bulunamadı.", "NOT_FOUND")) : Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/events", async (
            string? search, Guid? categoryId, Guid? facilityId, string? district, DateTime? from, DateTime? to, bool? includePast, int? page, int? limit,
            IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var key = $"pub:events:{search}:{categoryId}:{facilityId}:{district}:{from:yyyyMMdd}:{to:yyyyMMdd}:{includePast}:{page}:{limit}";
            var data = await CacheGet(cache, cfg, key, () => svc.GetEventsAsync(
                new PublicEventQuery(search, categoryId, facilityId, district, from, to, includePast ?? false, page ?? 1, limit ?? 50), ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/events/calendar", async (
            DateTime? from, DateTime? to, IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var f = from ?? DateTime.UtcNow.Date;
            var t = to ?? f.AddMonths(1);
            var data = await CacheGet(cache, cfg, $"pub:events:cal:{f:yyyyMMdd}:{t:yyyyMMdd}", () => svc.GetEventCalendarAsync(f, t, ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/events/categories", async (
            IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var data = await CacheGet(cache, cfg, "pub:events:categories", () => svc.GetEventCategoriesAsync(ct));
            return Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/events/{id:guid}", async (
            Guid id, IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var data = await CacheGet(cache, cfg, $"pub:event:{id}", () => svc.GetEventAsync(id, ct));
            return data is null ? Results.NotFound(ApiResponse.Fail(404, "Etkinlik bulunamadı.", "NOT_FOUND")) : Results.Ok(ApiResponse.Ok(data));
        });

        group.MapGet("/events/{id:guid}/sessions", async (
            Guid id, IPublicCatalogService svc, IMemoryCache cache, Microsoft.Extensions.Configuration.IConfiguration cfg, CancellationToken ct) =>
        {
            var data = await CacheGet(cache, cfg, $"pub:event:{id}:sessions", () => svc.GetEventSessionsAsync(id, ct));
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
