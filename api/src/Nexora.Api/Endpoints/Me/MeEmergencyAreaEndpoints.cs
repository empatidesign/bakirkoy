using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantEmergencyAreas;

namespace Nexora.Api.Endpoints.Me;

public static class MeEmergencyAreaEndpoints
{
    public static IEndpointRouteBuilder MapMeEmergencyAreaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/emergency-areas")
            .WithTags("MeEmergencyAreas")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList);
        group.MapGet("/{id:guid}", GetDetail);

        return app;
    }

    private static async Task<IResult> GetList(IParticipantEmergencyAreaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetListAsync(ct)));

    private static async Task<IResult> GetDetail(Guid id, IParticipantEmergencyAreaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(id, ct)));
}
