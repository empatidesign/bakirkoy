using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.DutyPharmacies;

namespace Nexora.Api.Endpoints.Me;

public static class MeDutyPharmacyEndpoints
{
    public static IEndpointRouteBuilder MapMeDutyPharmacyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/duty-pharmacies")
            .WithTags("MeDutyPharmacies")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList).AllowAnonymous();

        return app;
    }

    private static async Task<IResult> GetList(IDutyPharmacyService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetActiveAsync(ct)));
}
