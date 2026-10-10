using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyMe;

namespace Nexora.Api.Endpoints.CompanyMe;

// IDN-İşletme (2026-09-11): mobil BusinessValidateScreen'in çağırdığı
// /api/v1/business/me/campaigns/{id}/search ve /validate/{participationId}
// için eklendi. Bu iki yol, halihazırda çalışan CompanyMeEndpoints
// (/api/v1/company/me/*) ile aynı ICompanyMeService.SearchParticipantAsync /
// ValidateParticipantAsync'i çağırır — yalnızca mobil'in beklediği farklı
// path altında expose eder, iş mantığı tekilleştirilmiştir.
public static class BusinessValidationEndpoints
{
    public static IEndpointRouteBuilder MapBusinessValidationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/business/me/campaigns")
            .WithTags("BusinessValidation")
            .RequireAuthorization("CompanyOrStaff");

        group.MapPost("/{campaignId:guid}/search", SearchParticipant);
        group.MapPost("/{campaignId:guid}/validate/{participationId:guid}", ValidateParticipant);

        // IDN-İşletme (2026-09-11): mobil BusinessServiceFormScreen'in CRUD
        // yaptığı hizmet kataloğu. company/me değil business/me altında —
        // mobil ENDPOINTS.business.services* sabitleriyle birebir eşleşir.
        var offerings = app.MapGroup("/api/v1/business/me/services")
            .WithTags("BusinessOfferings")
            .RequireAuthorization("CompanyOrStaff");

        offerings.MapGet("/", GetOfferings);
        offerings.MapGet("/stats", GetOfferingStats);
        offerings.MapGet("/{id:guid}", GetOffering);
        offerings.MapPost("/", CreateOffering);
        offerings.MapPut("/{id:guid}", UpdateOffering);
        offerings.MapDelete("/{id:guid}", DeleteOffering);

        return app;
    }

    private static Guid CompanyId(ICurrentUser currentUser)
        => currentUser.Id ?? throw new Nexora.Application.Common.Exceptions.ForbiddenException("Kimlik doğrulaması gerekli.", "UNAUTHORIZED");

    // RedeemManualAsync'e giden ValidateParticipant, CompanyMeEndpoints.ResolveRedeemCompanyId
    // ile aynı yetki kuralını (CanRedeem) uygular — kampanya kullandırma yetkisi olmayan
    // personel bu uçtan da geçemez.
    private static Guid ResolveRedeemCompanyId(ICurrentUser currentUser)
    {
        if (!currentUser.CanRedeem)
            throw new Nexora.Application.Common.Exceptions.ForbiddenException(
                "Kampanya kullandırma yetkiniz bulunmuyor. Firma yetkilinizle iletişime geçin.", "REDEEM_NOT_ALLOWED");
        return currentUser.CompanyStaffCompanyId ?? CompanyId(currentUser);
    }

    private static async Task<IResult> SearchParticipant(
        Guid campaignId, SearchParticipantRequest req, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.SearchParticipantAsync(ResolveRedeemCompanyId(currentUser), campaignId, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> ValidateParticipant(
        Guid campaignId, Guid participationId, string? method, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.ValidateParticipantAsync(ResolveRedeemCompanyId(currentUser), campaignId, participationId, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    // NOT: hizmet CRUD için CanRedeem gerekmez — bu işletme sahibi/yönetici
    // işlevidir (CompanyOrStaff auth policy zaten temel yetkiyi doğrular).
    private static async Task<IResult> GetOfferings(
        string? category, bool? isActive, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.GetOfferingsAsync(CompanyId(currentUser), category, isActive, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetOfferingStats(ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.GetOfferingStatsAsync(CompanyId(currentUser), ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetOffering(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.GetOfferingAsync(CompanyId(currentUser), id, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> CreateOffering(
        CreateCompanyOfferingRequest req, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.CreateOfferingAsync(CompanyId(currentUser), req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> UpdateOffering(
        Guid id, UpdateCompanyOfferingRequest req, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        var result = await service.UpdateOfferingAsync(CompanyId(currentUser), id, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> DeleteOffering(Guid id, ICompanyMeService service, ICurrentUser currentUser, CancellationToken ct)
    {
        await service.DeleteOfferingAsync(CompanyId(currentUser), id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
