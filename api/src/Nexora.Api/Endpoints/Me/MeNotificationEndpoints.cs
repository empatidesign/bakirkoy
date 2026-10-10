using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Notifications;

namespace Nexora.Api.Endpoints.Me;

public static class MeNotificationEndpoints
{
    public static IEndpointRouteBuilder MapMeNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/notifications")
            .WithTags("MeNotifications")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList)
            .WithSummary("Bildirim listesi")
            .WithDescription("Kullanıcının bildirimlerini sayfalı döner. `scope=self` yalnızca kendisini, varsayılan `family` çocuk hesaplarını da kapsar.");
        group.MapGet("/unread-count", GetUnreadCount)
            .WithSummary("Okunmamış bildirim sayısı")
            .WithDescription("Bildirim zilindeki rozet için okunmamış adedini döner.");
        group.MapPatch("/{id:guid}/read", MarkRead)
            .WithSummary("Bildirimi okundu işaretle");
        group.MapPatch("/read-all", MarkAllRead)
            .WithSummary("Tümünü okundu işaretle")
            .WithDescription("Onay bekleyen zorunlu duyurular bunun dışındadır: kullanıcı metni görmeden onaylamış sayılmaz, onlar yalnızca `/acknowledge` ile kapanır.");

        // Kullanıcı isteği (2026-09-01): zorunlu onaylı duyuru — "okudum" demeden kapatılamaz.
        group.MapGet("/pending-acknowledgements", GetPendingAcks)
            .WithSummary("Onay bekleyen duyurular")
            .WithDescription("Kapatılamaz popup olarak gösterilmesi gereken duyuruları eskiden yeniye döner. Uygulama açılışında ve periyodik olarak çağrılır; liste boşalana kadar popup kapanmaz.");
        group.MapPost("/{id:guid}/acknowledge", Acknowledge)
            .WithSummary("Duyuruyu okudum olarak onayla")
            .WithDescription("Zorunlu duyuruyu onaylar ve okundu işaretler. Yalnızca bildirimin sahibi çağırabilir; başkasının duyurusu için 403 döner.");

        return app;
    }

    private static async Task<IResult> GetPendingAcks(
        ICurrentUser currentUser, INotificationService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        return Results.Ok(ApiResponse.Ok(await service.GetPendingAcknowledgementsAsync(participantId, ct)));
    }

    private static async Task<IResult> Acknowledge(
        Guid id, ICurrentUser currentUser, INotificationService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        await service.AcknowledgeAsync(participantId, id, ct);
        return Results.Ok(ApiResponse.Ok<object?>(null));
    }

    private static async Task<IResult> GetList(
        string? scope, int? page, int? limit,
        ICurrentUser currentUser, INotificationService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        var result = await service.GetForRecipientAsync(participantId, scope, page ?? 1, limit ?? 25, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetUnreadCount(
        string? scope, ICurrentUser currentUser, INotificationService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        var unreadCount = await service.GetUnreadCountAsync(participantId, scope, ct);
        return Results.Ok(ApiResponse.Ok(new { unreadCount }));
    }

    private static async Task<IResult> MarkRead(
        Guid id, ICurrentUser currentUser, INotificationService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        await service.MarkReadAsync(participantId, id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> MarkAllRead(
        string? scope, ICurrentUser currentUser, INotificationService service, CancellationToken ct)
    {
        var participantId = RequireParticipant(currentUser);
        await service.MarkAllReadAsync(participantId, scope, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static Guid RequireParticipant(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");
}
