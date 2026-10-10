using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.ParticipantEvents;
using Nexora.Application.Features.ParticipantEvents.Dtos;
using Nexora.Application.Features.Reviews;
using Nexora.Application.Features.Reviews.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeEventEndpoints
{
    public static IEndpointRouteBuilder MapMeEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/events")
            .WithTags("MeEvents")
            .RequireAuthorization("Citizen");

        group.MapGet("/discover", Discover).AllowAnonymous();
        group.MapGet("/{eventId:guid}", GetDetail).AllowAnonymous();
        group.MapGet("/{eventId:guid}/seat-map", GetSeatMap).AllowAnonymous();
        group.MapGet("/{eventId:guid}/reviews", GetReviews).AllowAnonymous();

        group.MapGet("/applications", GetApplications);
        group.MapPost("/{eventId:guid}/apply", Apply);
        group.MapPost("/{eventId:guid}/check-in", CheckIn);
        group.MapDelete("/applications/{id:guid}", CancelApplication);
        group.MapPost("/{eventId:guid}/reviews", SubmitReview);
        // Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
        // cihazsız çalışsın" — Facility/Library'deki /me/{module}/static-scan ile birebir aynı.
        group.MapPost("/static-scan", ScanStaticQr);

        return app;
    }

    private static async Task<IResult> ScanStaticQr(
        ScanEventStaticQrPayload payload,
        IEventAttendanceService service,
        Nexora.Application.Common.Interfaces.ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.ScanStaticQrAsync(payload.Code, participantId, ct, payload.Latitude, payload.Longitude);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Discover([AsParameters] CitizenDiscoverParams p, IParticipantEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DiscoverAsync(p, ct)));

    private static async Task<IResult> GetDetail(Guid eventId, IParticipantEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(eventId, ct)));

    private static async Task<IResult> GetSeatMap(Guid eventId, Guid? sessionId, IParticipantEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatMapAsync(eventId, sessionId, ct)));

    private static async Task<IResult> Apply(Guid eventId, CitizenApplyRequest req, IParticipantEventService service, CancellationToken ct)
    {
        var result = await service.ApplyAsync(eventId, req ?? new CitizenApplyRequest(null, null, null), ct);
        return Results.Created($"/api/v1/me/events/applications/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> GetApplications([AsParameters] CitizenApplicationListParams p, IParticipantEventService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetApplicationsAsync(p, ct)));

    private static async Task<IResult> CheckIn(Guid eventId, CitizenCheckInRequest req, IParticipantEventService service, CancellationToken ct)
    {
        var result = await service.CheckInAsync(eventId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> CancelApplication(Guid id, IParticipantEventService service, CancellationToken ct)
    {
        await service.CancelApplicationAsync(id, ct);
        // Bkz. MeLibraryEndpoints.CancelReservation (madde 68) — iptal uçları boş 204 yerine
        // istemcinin gösterebileceği bir onay mesajı döner.
        return Results.Ok(ApiResponse.Ok(new { id, cancelled = true, message = "Etkinlik başvurunuz iptal edildi." }));
    }

    private static async Task<IResult> GetReviews(Guid eventId, IReviewService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetEventReviewsAsync(eventId, ct)));

    private static async Task<IResult> SubmitReview(Guid eventId, SubmitReviewRequest req, IReviewService service, CancellationToken ct)
    {
        var result = await service.SubmitEventReviewAsync(eventId, req, ct);
        return Results.Created($"/api/v1/me/events/{eventId}/reviews/{result.Id}", ApiResponse.Created(result));
    }
}

public record ScanEventStaticQrPayload(string Code, double? Latitude = null, double? Longitude = null);
