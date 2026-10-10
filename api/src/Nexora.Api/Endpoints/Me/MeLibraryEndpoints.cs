using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.ParticipantLibraries;
using Nexora.Application.Features.ParticipantLibraries.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeLibraryEndpoints
{
    public static IEndpointRouteBuilder MapMeLibraryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/libraries")
            .WithTags("MeLibraries")
            .RequireAuthorization("Citizen");

        group.MapGet("/", Discover);
        group.MapGet("/filters", GetFilters);
        group.MapGet("/reservations", GetReservations);
        group.MapDelete("/reservations/{id:guid}", CancelReservation);
        group.MapGet("/{libraryId:guid}", GetDetail);
        group.MapGet("/{libraryId:guid}/seat-plan", GetSeatPlan);
        group.MapPost("/{libraryId:guid}/reservations", Reserve);

        group.MapPost("/pending-exit", RegisterPendingExit);
        group.MapPost("/pending-break", RegisterPendingBreak);
        group.MapGet("/session", GetSession);
        group.MapGet("/my-queue", GetMyQueue);
        group.MapGet("/history", GetHistory);
        group.MapGet("/my-stats", GetMyStats);
        group.MapGet("/{libraryId:guid}/status", GetStatus);
        group.MapGet("/{libraryId:guid}/stats", GetStats);
        group.MapPost("/{libraryId:guid}/walk-in", WalkIn);
        group.MapPost("/{libraryId:guid}/queue", JoinQueue);
        group.MapDelete("/{libraryId:guid}/queue", LeaveQueue);
        group.MapPost("/{libraryId:guid}/check-in", CheckIn);
        group.MapPost("/break", StartBreak);
        group.MapPost("/break/end", EndBreak);
        group.MapPost("/exit", Exit);
        group.MapGet("/overdue-books", GetMyOverdueBooks);
        group.MapPost("/static-scan", ScanStaticQr);

        return app;
    }

    private static async Task<IResult> ScanStaticQr(
        ScanLibraryStaticQrPayload payload,
        ILibraryOperationsService service,
        Nexora.Application.Common.Interfaces.ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.ScanStaticQrAsync(payload.Code, participantId, payload.Latitude, payload.Longitude, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Discover([AsParameters] CitizenLibraryDiscoverParams p, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.DiscoverAsync(p, ct)));

    private static async Task<IResult> GetFilters([AsParameters] CitizenLibraryDiscoverParams p, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetFiltersAsync(p, ct)));

    private static async Task<IResult> GetDetail(Guid libraryId, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(libraryId, ct)));

    private static async Task<IResult> GetSeatPlan(Guid libraryId, DateTime? date, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSeatPlanAsync(libraryId, date, ct)));

    private static async Task<IResult> Reserve(Guid libraryId, CitizenLibraryReserveRequest req, IParticipantLibraryService service, CancellationToken ct)
    {
        var result = await service.ReserveAsync(libraryId, req ?? new CitizenLibraryReserveRequest(null, null, null), ct);
        return Results.Created($"/api/v1/me/libraries/reservations/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> GetReservations([AsParameters] CitizenLibraryReservationListParams p, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetReservationsAsync(p, ct)));

    private static async Task<IResult> CancelReservation(Guid id, IParticipantLibraryService service, CancellationToken ct)
    {
        await service.CancelReservationAsync(id, ct);
        // Mobil QA bulgusu (2026-09-22, madde 68): "İptal edilebiliyor fakat iptal edildiğine
        // dair bilgilendirme yok". Uç boş bir 204 dönüyordu; istemci gösterecek bir mesaj
        // bulamadığı için işlem sessizce tamamlanıyordu. Artık iptal edilen kaydın id'siyle
        // birlikte kullanıcıya gösterilebilir bir mesaj dönüyor.
        return Results.Ok(ApiResponse.Ok(new { id, cancelled = true, message = "Rezervasyonunuz iptal edildi." }));
    }

    private static async Task<IResult> RegisterPendingExit(CitizenLibraryCheckInRequest? req, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RegisterExitIntentAsync(ct)));

    private static async Task<IResult> RegisterPendingBreak(CitizenBreakRequest? req, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RegisterBreakIntentAsync(req?.Type, ct)));

    private static async Task<IResult> GetSession(IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetActiveSessionAsync(ct)));

    private static async Task<IResult> GetMyQueue(IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyQueueAsync(ct)));

    private static async Task<IResult> GetHistory(DateTime? date, string? range, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(new { items = await service.GetHistoryAsync(date, range, ct) }));

    private static async Task<IResult> GetMyStats(IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyStatsAsync(ct)));

    private static async Task<IResult> GetStatus(Guid libraryId, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetStatusAsync(libraryId, ct)));

    private static async Task<IResult> GetStats(Guid libraryId, DateTime? date, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetStatsAsync(libraryId, date, ct)));

    private static async Task<IResult> WalkIn(Guid libraryId, CitizenWalkInRequest? req, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.WalkInAsync(libraryId, req?.Seat, ct)));

    private static async Task<IResult> JoinQueue(Guid libraryId, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.JoinQueueAsync(libraryId, ct)));

    private static async Task<IResult> LeaveQueue(Guid libraryId, IParticipantLibraryService service, CancellationToken ct)
    {
        await service.LeaveQueueAsync(libraryId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> CheckIn(Guid libraryId, CitizenLibraryCheckInRequest? req, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CheckInAsync(libraryId, req?.Latitude, req?.Longitude, ct)));

    private static async Task<IResult> StartBreak(CitizenBreakRequest? req, IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.StartBreakAsync(req?.Type, ct)));

    private static async Task<IResult> EndBreak(IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.EndBreakAsync(ct)));

    private static async Task<IResult> Exit(CitizenLibraryCheckInRequest? req, IParticipantLibraryService service, CancellationToken ct)
    {
        await service.ExitAsync(ct, req?.Latitude, req?.Longitude);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetMyOverdueBooks(IParticipantLibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyOverdueBooksAsync(ct)));
}

public record ScanLibraryStaticQrPayload(string Code, double? Latitude = null, double? Longitude = null);
public record CitizenLibraryCheckInRequest(double? Latitude = null, double? Longitude = null);
