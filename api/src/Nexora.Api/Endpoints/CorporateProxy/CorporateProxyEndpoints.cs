using Nexora.Application.Features.CorporateProxy;

namespace Nexora.Api.Endpoints.CorporateProxy;

/// <summary>
/// Kurumsal API (sultangazi.bel.tr/api/v2) proxy ucu.
///
/// bkz. ICorporateApiProxyService dokümantasyonu ve GUVENLIK-YOL-HARITASI.md
/// madde 2. Mobil uygulama artık kurumsal API'ye doğrudan gitmez, secret'ı
/// hiç görmez; bu tek uca gelir.
///
/// AllowAnonymous: kurumsal içerik (haberler, encümen, banner'lar) mobil
/// uygulamada kullanıcı giriş yapmadan önce, ana sayfa açılışında gösterilir
/// — kurumsal API'nin kendisi de client_credentials ile çalışır, kullanıcı
/// bazlı bir yetki kavramı yoktur. Kötüye kullanım "device" rate-limit
/// politikasıyla (IP başına, Redis'te dağıtık — bkz. Program.cs) sınırlanır.
///
/// Yol allowlist'i CorporateApiAllowedPaths'te sabittir; bu uç serbest bir
/// passthrough DEĞİLDİR. Listede olmayan bir yol 404 döner (kurumsal API'ye
/// hiç istek atılmaz).
/// </summary>
public static class CorporateProxyEndpoints
{
    public static IEndpointRouteBuilder MapCorporateProxyEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/corporate/{**path}", Handle)
            .WithTags("CorporateProxy")
            .AllowAnonymous()
            .RequireRateLimiting("device");

        return app;
    }

    private static async Task<IResult> Handle(
        string path,
        HttpRequest request,
        ICorporateApiProxyService proxy,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(path) || !CorporateApiAllowedPaths.IsAllowed(path))
            return Results.NotFound();

        var result = await proxy.GetAsync(path, request.QueryString.HasValue ? request.QueryString.Value!.TrimStart('?') : null, ct);

        if (result.Body is null)
            return Results.StatusCode(result.StatusCode == 0 ? 502 : result.StatusCode);

        return Results.Content(result.Body, result.ContentType ?? "application/json", statusCode: result.StatusCode);
    }
}
