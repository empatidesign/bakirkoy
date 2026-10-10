using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.CitizenIdentity;
using Nexora.Application.Features.QrPasses;

namespace Nexora.Api.Endpoints.Me;

public static class MeIdentityEndpoints
{
    public static IEndpointRouteBuilder MapMeIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me")
            .WithTags("MeIdentity")
            .RequireAuthorization("Citizen");

        group.MapGet("/identity-qr", GetIdentityQr);
        group.MapGet("/qr-passes", GetQrPasses);

        return app;
    }

    private static async Task<IResult> GetQrPasses(
        IQrPassService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new UnauthorizedAccessException("Oturum bulunamadı.");

        var result = await service.GetPassesAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetIdentityQr(
        ICitizenIdentityQrService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new UnauthorizedAccessException("Oturum bulunamadı.");

        var result = await service.GenerateAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}
