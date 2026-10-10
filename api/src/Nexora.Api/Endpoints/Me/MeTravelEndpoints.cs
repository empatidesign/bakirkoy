using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantTravels;
using Nexora.Application.Features.ParticipantTravels.Dtos;
using Nexora.Application.Features.Reviews;
using Nexora.Application.Features.Reviews.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeTravelEndpoints
{
    public static IEndpointRouteBuilder MapMeTravelEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/travels")
            .WithTags("MeTravels")
            .RequireAuthorization("Citizen");

        // Misafir gezileri görebilmeli (etkinliklerdeki gibi); rezervasyon giriş ister.
        group.MapGet("/discover", Discover).AllowAnonymous();
        group.MapGet("/applications", GetApplications);
        group.MapPost("/guest-lookup", GuestLookup);
        group.MapGet("/{travelId:guid}", GetDetail).AllowAnonymous();
        group.MapGet("/{travelId:guid}/seat-map", GetSeatMap).AllowAnonymous();
        group.MapPost("/{travelId:guid}/reserve", Reserve);
        group.MapDelete("/applications/{id:guid}", CancelApplication);
        group.MapGet("/{travelId:guid}/reviews", GetReviews).AllowAnonymous();
        group.MapPost("/{travelId:guid}/reviews", SubmitReview);

        return app;
    }

    private static async Task<IResult> Discover([AsParameters] CitizenTravelDiscoverParams p, IParticipantTravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DiscoverAsync(p, ct)));

    private static async Task<IResult> GetDetail(Guid travelId, IParticipantTravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(travelId, ct)));

    private static async Task<IResult> GetSeatMap(Guid travelId, IParticipantTravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatMapAsync(travelId, ct)));

    private static async Task<IResult> GuestLookup(CitizenTravelGuestLookupRequest req, IParticipantTravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GuestLookupAsync(req, ct)));

    private static async Task<IResult> Reserve(Guid travelId, CitizenTravelReserveRequest req, IParticipantTravelService service, CancellationToken ct)
    {
        var result = await service.ReserveAsync(travelId, req ?? new CitizenTravelReserveRequest(null, null), ct);
        return Results.Created($"/api/v1/me/travels/applications/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> GetApplications([AsParameters] CitizenTravelApplicationListParams p, IParticipantTravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetApplicationsAsync(p, ct)));

    private static async Task<IResult> CancelApplication(Guid id, IParticipantTravelService service, CancellationToken ct)
    {
        await service.CancelApplicationAsync(id, ct);
        // Bkz. MeLibraryEndpoints.CancelReservation (madde 68) — iptal uçları boş 204 yerine
        // istemcinin gösterebileceği bir onay mesajı döner.
        return Results.Ok(ApiResponse.Ok(new { id, cancelled = true, message = "Gezi başvurunuz iptal edildi." }));
    }

    private static async Task<IResult> GetReviews(Guid travelId, IReviewService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTravelReviewsAsync(travelId, ct)));

    private static async Task<IResult> SubmitReview(Guid travelId, SubmitReviewRequest req, IReviewService service, CancellationToken ct)
    {
        var result = await service.SubmitTravelReviewAsync(travelId, req, ct);
        return Results.Created($"/api/v1/me/travels/{travelId}/reviews/{result.Id}", ApiResponse.Created(result));
    }
}
