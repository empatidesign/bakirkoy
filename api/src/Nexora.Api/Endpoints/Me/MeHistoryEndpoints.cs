using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.History;
using Nexora.Application.Features.History.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeHistoryEndpoints
{
    public static IEndpointRouteBuilder MapMeHistoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/history")
            .WithTags("MeHistory")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetHistory);

        return app;
    }

    private static async Task<IResult> GetHistory(
        [AsParameters] HistoryListParams p,
        IHistoryService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetHistoryAsync(p, ct)));
}
