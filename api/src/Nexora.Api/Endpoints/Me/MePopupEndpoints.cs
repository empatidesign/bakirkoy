using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Popups;
using Nexora.Application.Features.Popups.Dtos;

namespace Nexora.Api.Endpoints.Me;

/// <summary>
/// Vatandaş uygulaması popup ucu: hangi tetiklemede (ilk giriş / her giriş / modüle giriş)
/// gösterilecek popup varsa döner, "okudum/izledim" onayını kaydeder.
/// </summary>
public static class MePopupEndpoints
{
    public static IEndpointRouteBuilder MapMePopupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/popups")
            .WithTags("MePopups")
            .RequireAuthorization("Citizen");

        group.MapGet("/next", GetNext)
            .WithSummary("Sıradaki popup")
            .WithDescription("Belirtilen tetikleme (trigger=first_login|every_login|module_enter, module_enter için moduleKey zorunlu) için gösterilecek popup varsa döner; yoksa null. İçerik dönerse aynı çağrıda gösterim sayacı artırılır.");
        group.MapPost("/{id:guid}/acknowledge", Acknowledge)
            .WithSummary("Popup onayı")
            .WithDescription("Zorunlu popup'ta 'okudum/izledim' onayı; opsiyonel popup'ta ayrıca 'bir daha gösterme' (dismissForever) seçilebilir.");

        return app;
    }

    private static async Task<IResult> GetNext(string trigger, string? moduleKey, IPopupService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok<CitizenPopupDto?>(await service.GetNextForTriggerAsync(trigger, moduleKey, ct)));

    private static async Task<IResult> Acknowledge(Guid id, PopupAcknowledgeRequest req, IPopupService service, CancellationToken ct)
    {
        await service.AcknowledgeAsync(id, req, ct);
        return Results.Ok(ApiResponse.Ok<object?>(null));
    }
}
