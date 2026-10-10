using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;

namespace Nexora.Api.Endpoints.Wheels;

public static class GiftRequestEndpoints
{
    public static IEndpointRouteBuilder MapGiftRequestEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/gift-requests")
            .WithTags("GiftRequests")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("wheel.view");
        group.MapGet("/summary", GetSummary).RequirePermission("wheel.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("wheel.view");
        group.MapPatch("/{id:guid}/approve", Approve).RequirePermission("wheel.approve");
        group.MapPatch("/{id:guid}/reject", Reject).RequirePermission("wheel.edit");
        group.MapPatch("/{id:guid}/deliver", Deliver).RequirePermission("wheel.edit");

        var wheelGroup = app.MapGroup("/api/v1/wheel")
            .WithTags("GiftRequests")
            .RequireAuthorization("AdminOrAbove");
        wheelGroup.MapPost("/gift-requests/messages/send", SendMessage).RequirePermission("wheel.edit");
        wheelGroup.MapGet("/notification-settings", GetNotificationSettings).RequirePermission("wheel.view");
        wheelGroup.MapPut("/notification-settings", SaveNotificationSettings).RequirePermission("wheel.edit");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] GiftRequestListParams p,
        IGiftRequestService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        string? giftId,
        string? status,
        IGiftRequestService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new GiftRequestListParams { Search = search, GiftId = giftId, Status = status }, ct)));

    private static async Task<IResult> GetById(
        Guid id,
        IGiftRequestService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Approve(
        Guid id,
        IGiftRequestService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ApproveAsync(id, ct)));

    private static async Task<IResult> Reject(
        Guid id,
        GiftRequestRejectRequest? body,
        IGiftRequestService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RejectAsync(id, body?.Reason, ct)));

    private static async Task<IResult> Deliver(
        Guid id,
        GiftRequestDeliverRequest? body,
        IGiftRequestService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DeliverAsync(id, body?.Note, ct)));

    private static async Task<IResult> SendMessage(ModuleManualMessageRequest req, IGiftRequestService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendManualMessageAsync(req, ct)));

    private static async Task<IResult> GetNotificationSettings(IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync("wheel", ct)));

    private static async Task<IResult> SaveNotificationSettings(ModuleNotificationSettingsDto req, IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync("wheel", req, ct)));
}
