using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.QrSystem;
using Nexora.Application.Features.QrSystem.Dtos;

namespace Nexora.Api.Endpoints.QrSystem;

public static class CitizenQrEndpoints
{
    public static IEndpointRouteBuilder MapCitizenQrEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/qr/citizen")
            .WithTags("QrSystem");

        group.MapGet("/token", GetToken).RequireAuthorization("Citizen");
        group.MapGet("/redemptions", GetRedemptions).RequireAuthorization("Citizen");
        group.MapPost("/scan-company", ScanCompany).RequireAuthorization("Citizen");
        group.MapPost("/redeem", CitizenRedeem).RequireAuthorization("Citizen");

        return app;
    }

    private static async Task<IResult> GetToken(
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GenerateCitizenTokenAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetRedemptions(
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.GetParticipantRedemptionsAsync(participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ScanCompany(
        ScanCompanyQrPayload payload,
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var result = await service.ScanCompanyQrAsync(payload.StaticCode, participantId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
    private static async Task<IResult> CitizenRedeem(
        CitizenRedeemPayload payload,
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var participantId = currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");
        var req = new RedeemCampaignRequest(participantId, payload.CampaignId, null);
        var result = await service.RedeemCampaignByStaticCodeAsync(payload.StaticCode, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}

public record ScanCompanyQrPayload(string StaticCode);
public record CitizenRedeemPayload(string StaticCode, Guid CampaignId);
