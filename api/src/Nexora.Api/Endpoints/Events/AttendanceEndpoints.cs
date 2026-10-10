using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Api.Endpoints.Events;

public static class AttendanceEndpoints
{
    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        var activity = app.MapGroup("/api/v1/event-activity")
            .WithTags("EventActivity")
            .RequireAuthorization("AdminOrAbove");

        activity.MapGet("/", GetActivity).RequirePermission("sessions.view");
        activity.MapGet("/summary", GetActivitySummary).RequirePermission("sessions.view");
        activity.MapGet("/export", Export).RequirePermission("sessions.view");
        activity.MapPost("/check-in", CheckIn).RequirePermission("sessions.edit");

        // Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
        // cihazsız çalışsın" — Facility'deki /facilities/{id}/static-qr... ile birebir aynı.
        var events = app.MapGroup("/api/v1/events")
            .WithTags("EventStaticQr")
            .RequireAuthorization("AdminOrAbove");

        events.MapGet("/{eventId:guid}/static-qr", async (Guid eventId, IEventAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.GetStaticQrAsync(eventId, ct)))).RequirePermission("events.edit");

        events.MapPatch("/{eventId:guid}/static-qr/toggle", async (Guid eventId, ToggleEventStaticQrRequest req, IEventAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.ToggleStaticQrAsync(eventId, req.Enabled, ct)))).RequirePermission("events.edit");

        events.MapPatch("/{eventId:guid}/static-qr/mode", async (Guid eventId, SetEventStaticQrModeRequest req, IEventAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SetStaticQrModeAsync(eventId, req.Mode, ct)))).RequirePermission("events.edit");

        events.MapPatch("/{eventId:guid}/static-qr/timing", async (Guid eventId, SetEventStaticQrTimingRequest req, IEventAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.SetStaticQrTimingAsync(eventId, req.MinExitSeconds, req.ReentryCooldownSeconds, ct)))).RequirePermission("events.edit");

        events.MapPost("/{eventId:guid}/static-qr/rotate", async (Guid eventId, IEventAttendanceService svc, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await svc.RotateStaticQrAsync(eventId, ct)))).RequirePermission("events.edit");

        return app;
    }

    private static async Task<IResult> GetActivity([AsParameters] ActivityListParams p, IEventAttendanceService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetActivityAsync(p, ct)));

    private static async Task<IResult> GetActivitySummary([AsParameters] ActivityListParams p, IEventAttendanceService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetActivitySummaryAsync(p, ct)));

    private static async Task<IResult> Export([AsParameters] ActivityListParams p, IEventAttendanceService service, CancellationToken ct)
    {
        var (content, fileName) = await service.ExportAsync(p, ct);
        return Results.File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static async Task<IResult> CheckIn(CheckInRequest req, IEventAttendanceService service, CancellationToken ct)
    {
        var result = await service.CheckInAsync(req, ct);
        return Results.Created($"/api/v1/event-activity/{result.Id}", ApiResponse.Created(result));
    }

}
