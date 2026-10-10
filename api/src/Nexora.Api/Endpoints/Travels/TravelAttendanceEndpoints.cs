using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelAttendanceEndpoints
{
    public static IEndpointRouteBuilder MapTravelAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travels/{travelId:guid}/attendance")
            .WithTags("TravelAttendance")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/roster", GetRoster).RequirePermission("travels.view");
        group.MapGet("/export", Export).RequirePermission("travels.view");
        group.MapPost("/save", Save).RequirePermission("travels.edit");
        group.MapPost("/reopen", Reopen).RequirePermission("travels.edit");

        return app;
    }

    private static async Task<IResult> GetRoster(Guid travelId, ITravelAttendanceService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetRosterAsync(travelId, ct)));

    private static async Task<IResult> Export(Guid travelId, ITravelAttendanceService service, CancellationToken ct)
    {
        var (content, fileName) = await service.ExportAsync(travelId, ct);
        return Results.File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static async Task<IResult> Save(Guid travelId, SaveTravelAttendanceRequest req, ITravelAttendanceService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync(travelId, req ?? new SaveTravelAttendanceRequest([]), ct)));

    private static async Task<IResult> Reopen(Guid travelId, ITravelAttendanceService service, CancellationToken ct)
    {
        await service.ReopenAsync(travelId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
