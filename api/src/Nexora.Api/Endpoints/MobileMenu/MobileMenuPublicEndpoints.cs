using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.MobileMenu;

namespace Nexora.Api.Endpoints.MobileMenu;

public static class MobileMenuPublicEndpoints
{
    public static IEndpointRouteBuilder MapMobileMenuPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/menu")
            .WithTags("MeMenu")
            .RequireAuthorization("Citizen");

        group.MapGet("/", async (IMobileMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetPublicMenuAsync(ct))));

        group.MapGet("/banner/{pageKey}", async (string pageKey, IMobileMenuService s, CancellationToken ct) =>
        {
            var banner = await s.GetPublicBannerAsync(pageKey, ct);
            return Results.Ok(ApiResponse.Ok(banner));
        });

        return app;
    }

    /// <summary>
    /// Native mobil uygulamanın (sultansehir-app) hızlı menü/özellik kartları anasayfada,
    /// vatandaş GİRİŞ YAPMADAN önce de gösterilir (nöbetçi eczane, toplanma yerleri,
    /// randevu vb. herkese açık bilgiler). /me/menu ucu "Citizen" policy'siyle korunduğu
    /// için misafir kullanıcıda 401 dönüyordu — bu anonim uç aynı görünür öğe listesini
    /// (RequiresAuth bayrağıyla birlikte) auth olmadan sağlar. Uygulama tarafı,
    /// RequiresAuth=true olan öğelere tıklandığında zaten kendi giriş akışına yönlendirir.
    /// </summary>
    public static IEndpointRouteBuilder MapMobileMenuAnonymousEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/public/mobile-menu")
            .WithTags("MobileMenu");

        group.MapGet("/", async (IMobileMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetPublicMenuAsync(ct))));

        group.MapGet("/banner/{pageKey}", async (string pageKey, IMobileMenuService s, CancellationToken ct) =>
        {
            var banner = await s.GetPublicBannerAsync(pageKey, ct);
            return Results.Ok(ApiResponse.Ok(banner));
        });

        return app;
    }
}

