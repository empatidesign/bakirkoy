using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Api.Endpoints.Companies;

// DiscountUsageEndpoints ile aynı desende — admin panelin CampaignRedemption (çark/QR kampanya
// kullanımı) kayıtlarını da DiscountUsage gibi listeleyip raporlayabilmesi için eklendi
// (bkz. loyalty-ecosystem-audit-2026-08-04 P0 bulgusu — canlı testte doğrulandı:
// GET /api/v1/discount-usages → 200, GET /api/v1/campaign-redemptions → 404).
public static class CampaignRedemptionEndpoints
{
    public static IEndpointRouteBuilder MapCampaignRedemptionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/campaign-redemptions")
            .WithTags("CampaignRedemptions")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("companies.view");
        group.MapGet("/summary", GetSummary).RequirePermission("companies.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("companies.view");
        group.MapPost("/{id:guid}/cancel", Cancel).RequirePermission("companies.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] CampaignRedemptionListParams p, ICampaignRedemptionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        Guid? companyId,
        Guid? campaignId,
        string? redemptionType,
        string? dateRange,
        ICampaignRedemptionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new CampaignRedemptionListParams { Search = search, CompanyId = companyId, CampaignId = campaignId, RedemptionType = redemptionType, DateRange = dateRange }, ct)));

    private static async Task<IResult> GetById(Guid id, ICampaignRedemptionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    // Hata #22: yanlışlıkla kullandırılan bir kampanyayı iptal edip hakkı geri verecek endpoint.
    private static async Task<IResult> Cancel(Guid id, CancelRedemptionRequest? req, ICampaignRedemptionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CancelAsync(id, req?.Reason, ct)));
}
