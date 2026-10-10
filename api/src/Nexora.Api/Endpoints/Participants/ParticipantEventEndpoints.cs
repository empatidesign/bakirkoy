using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Participants;
using Nexora.Application.Features.Participants.Dtos;

namespace Nexora.Api.Endpoints.Participants;

public static class ParticipantEventEndpoints
{
    public static IEndpointRouteBuilder MapParticipantEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/participant-events")
            .WithTags("ParticipantEvents")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("participants.view");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] ParticipantEventListParams p,
        IParticipantEventHistoryService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetListAsync(p, ct)));
}
