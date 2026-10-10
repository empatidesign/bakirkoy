using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Api.Endpoints.Companies;

public static class DiscountUsageEndpoints
{
    public static IEndpointRouteBuilder MapDiscountUsageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/discount-usages")
            .WithTags("DiscountUsages")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("companies.view");
        group.MapGet("/summary", GetSummary).RequirePermission("companies.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("companies.view");
        group.MapPost("/{id:guid}/cancel", Cancel).RequirePermission("companies.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] DiscountUsageListParams p, IDiscountUsageService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        Guid? companyId,
        Guid? campaignId,
        string? status,
        string? dateRange,
        IDiscountUsageService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new DiscountUsageListParams { Search = search, CompanyId = companyId, CampaignId = campaignId, Status = status, DateRange = dateRange }, ct)));

    private static async Task<IResult> GetById(Guid id, IDiscountUsageService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    // Hata #22: yanlışlıkla kullandırılan bir kampanyayı iptal edip hakkı geri verecek endpoint.
    private static async Task<IResult> Cancel(Guid id, CancelUsageRequest? req, IDiscountUsageService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CancelAsync(id, req?.Reason, ct)));
}
