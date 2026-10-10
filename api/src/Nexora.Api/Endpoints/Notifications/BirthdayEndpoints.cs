using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;

namespace Nexora.Api.Endpoints.Notifications;

/// <summary>
/// Kullanıcı isteği (2026-09-07): doğum günü kutlama mesajının sistem ayarlarından
/// düzenlenebilmesi — otomatik gönderilsin mi, hangi saatte, SMS mi push mu ikisi mi,
/// mesaj metni ne olsun, kaç saniye aralıkla gönderilsin.
/// </summary>
public static class BirthdayEndpoints
{
    public static IEndpointRouteBuilder MapBirthdayEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/birthday")
            .WithTags("Notifications")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/settings", GetSettings)
            .RequirePermission("broadcast.view")
            .WithSummary("Doğum günü kutlama ayarlarını döner");

        group.MapPut("/settings", SaveSettings)
            .RequirePermission("broadcast.send")
            .WithSummary("Doğum günü kutlama ayarlarını kaydeder");

        group.MapGet("/preview", Preview)
            .RequirePermission("broadcast.view")
            .WithSummary("Bugün doğum günü olanları listeler (gönderim yapmaz)");

        group.MapPost("/run", Run)
            .RequirePermission("broadcast.send")
            .WithSummary("Doğum günü gönderimini elle tetikler. dryRun=true ise mesaj gönderilmez.");

        group.MapGet("/status", GetStatus)
            .RequirePermission("broadcast.view")
            .WithSummary("Canlı durum: gönderim sürüyor mu, kaç mesaj gönderilmeyi bekliyor");

        group.MapPost("/cancel", Cancel)
            .RequirePermission("broadcast.send")
            .WithSummary("Süren gönderimi durdurur — gönderilmeyi bekleyen tüm mesajlar iptal edilir");

        return app;
    }

    private static async Task<IResult> GetSettings(IBirthdayGreetingService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSettingsAsync(ct)));

    private static async Task<IResult> SaveSettings(
        BirthdaySettingsDto dto,
        IBirthdayGreetingService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveSettingsAsync(dto, ct)));

    private static async Task<IResult> Preview(IBirthdayGreetingService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.PreviewAsync(ct)));

    private static async Task<IResult> GetStatus(IBirthdayGreetingService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetStatusAsync(ct)));

    private static async Task<IResult> Cancel(
        IBirthdayGreetingService service,
        Nexora.Application.Common.Interfaces.ICurrentUser currentUser,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CancelAsync(currentUser.Name ?? currentUser.Email, ct)));

    private static async Task<IResult> Run(
        bool? dryRun,
        IBirthdayGreetingService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RunAsync(dryRun ?? false, force: true, ct)));
}
