using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.MobileConfig;
using Nexora.Domain.Enums;

namespace Nexora.Api.Endpoints.MobileConfig;

public static class MobileConfigPublicEndpoints
{
    public static IEndpointRouteBuilder MapMobileConfigPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/mobile")
            .WithTags("MobileConfig");

        // platform: "android" | "ios". Geçersiz/eksik değer sürüm kontrolünü
        // devre dışı bırakır (uygulama açılır), hata döndürmez — açılış yolundaki
        // bir uç, tanımadığı bir istemciyi kilitlememeli.
        group.MapGet("/app-config", async (
            string? version,
            string? platform,
            IMobileConfigService s,
            CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetForClientAsync(version, ParsePlatform(platform), ct))))
            .AllowAnonymous();

        return app;
    }

    private static MobilePlatform? ParsePlatform(string? platform)
        => platform?.Trim().ToLowerInvariant() switch
        {
            "android" => MobilePlatform.Android,
            "ios" => MobilePlatform.Ios,
            _ => null,
        };
}
