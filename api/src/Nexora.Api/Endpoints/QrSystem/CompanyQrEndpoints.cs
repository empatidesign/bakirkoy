using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.QrSystem;
using Nexora.Application.Features.QrSystem.Dtos;

namespace Nexora.Api.Endpoints.QrSystem;

public static class CompanyQrEndpoints
{
    public static IEndpointRouteBuilder MapCompanyQrEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/qr/company")
            .WithTags("QrSystem");

        group.MapGet("/my-qr", GetMyQr).RequireAuthorization("Company");
        group.MapPost("/generate", GenerateQr).RequireAuthorization("Company");
        group.MapDelete("/{qrCodeId:guid}/deactivate", Deactivate).RequireAuthorization("Company");
        group.MapGet("/redemptions", GetRedemptions).RequireAuthorization("Company");
        group.MapPost("/scan-citizen", ScanCitizen).RequireAuthorization("CompanyOrStaff");
        group.MapPost("/redeem", Redeem).RequireAuthorization("CompanyOrStaff");

        return app;
    }

    private static Guid CompanyId(ICurrentUser currentUser)
        => currentUser.Id ?? throw new ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");

    private static Guid ResolveRedeemCompanyId(ICurrentUser currentUser)
    {
        if (!currentUser.CanRedeem)
            throw new ForbiddenException("Kampanya kullandırma yetkiniz bulunmuyor. Firma yetkilinizle iletişime geçin.", "REDEEM_NOT_ALLOWED");

        return currentUser.CompanyStaffCompanyId ?? CompanyId(currentUser);
    }

    private static async Task<IResult> GetMyQr(
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = CompanyId(currentUser);
        var result = await service.GenerateCompanyQrAsync(companyId, new GenerateCompanyQrRequest(null, DateTime.UtcNow.AddYears(1)), ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GenerateQr(
        GenerateCompanyQrRequest req,
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = CompanyId(currentUser);
        var result = await service.GenerateCompanyQrAsync(companyId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Deactivate(
        Guid qrCodeId,
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = CompanyId(currentUser);
        await service.DeactivateCompanyQrAsync(qrCodeId, companyId, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetRedemptions(
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = CompanyId(currentUser);
        var result = await service.GetCompanyRedemptionsAsync(companyId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ScanCitizen(
        ScanCitizenQrPayload payload,
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = ResolveRedeemCompanyId(currentUser);
        var result = await service.ScanCitizenQrAsync(payload.Token, companyId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Redeem(
        RedeemCampaignRequest req,
        IQrSystemService service,
        ICurrentUser currentUser,
        CancellationToken ct)
    {
        var companyId = ResolveRedeemCompanyId(currentUser);
        var result = await service.RedeemCampaignAsync(companyId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}

public record ScanCitizenQrPayload(string Token);
