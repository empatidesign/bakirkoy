using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantCampaigns;
using Nexora.Application.Features.ParticipantCampaigns.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeCampaignEndpoints
{
    public static IEndpointRouteBuilder MapMeCampaignEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/campaigns")
            .WithTags("MeCampaigns")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList);
        group.MapGet("/settings", GetSettings);
        group.MapGet("/categories", GetCategories);
        group.MapGet("/companies/{companyId:guid}", GetCompany);
        group.MapGet("/directory", GetDirectory);
        group.MapGet("/directory/districts", GetDirectoryDistricts);
        group.MapGet("/directory/{companyId:guid}", GetDirectoryCompany);
        group.MapGet("/my-usages", GetMyUsages);
        group.MapGet("/{id:guid}", GetDetail);
        group.MapPost("/{id:guid}/redeem", Redeem);
        group.MapPost("/{id:guid}/bookmark", AddBookmark);
        group.MapDelete("/{id:guid}/bookmark", RemoveBookmark);

        return app;
    }

    private static async Task<IResult> GetSettings(IParticipantCampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSettingsAsync(ct)));

    private static async Task<IResult> GetCategories(IParticipantCampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetCategoriesAsync(ct)));

    private static async Task<IResult> GetMyUsages(IParticipantCampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyUsagesAsync(ct)));

    private static async Task<IResult> GetList(
        string? page,
        string? limit,
        string? search,
        string? dateStatus,
        bool? onlySaved,
        Guid? companyId,
        bool? onlyNew,
        string? sortBy,
        double? lat,
        double? lng,
        HttpContext ctx,
        IParticipantCampaignService service,
        CancellationToken ct)
    {
        var categoryIds = ctx.Request.Query["categoryIds"]
            .Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .ToList();

        var p = new CitizenCampaignListParams
        {
            Page = page,
            Limit = limit,
            Search = search,
            CategoryIds = categoryIds.Count > 0 ? categoryIds : null,
            DateStatus = dateStatus,
            OnlySaved = onlySaved == true,
            CompanyId = companyId,
            OnlyNew = onlyNew == true,
            SortBy = sortBy,
            Latitude = lat,
            Longitude = lng,
        };

        return Results.Ok(ApiResponse.Ok(await service.GetListAsync(p, ct)));
    }

    private static async Task<IResult> GetCompany(Guid companyId, IParticipantCampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetCompanyAsync(companyId, ct)));

    private static async Task<IResult> GetDirectory(
        string? page,
        string? limit,
        string? search,
        string? district,
        bool? onlyWithCampaigns,
        bool? onlyWithLocation,
        double? lat,
        double? lng,
        string? sort,
        HttpContext ctx,
        IParticipantCampaignService service,
        CancellationToken ct)
    {
        var categoryIds = ctx.Request.Query["categoryIds"]
            .Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .ToList();

        var p = new CitizenDirectoryCompanyListParams
        {
            Page = page,
            Limit = limit,
            Search = search,
            CategoryIds = categoryIds.Count > 0 ? categoryIds : null,
            District = district,
            OnlyWithCampaigns = onlyWithCampaigns == true,
            OnlyWithLocation = onlyWithLocation == true,
            Latitude = lat,
            Longitude = lng,
            Sort = sort,
        };

        return Results.Ok(ApiResponse.Ok(await service.GetDirectoryAsync(p, ct)));
    }

    private static async Task<IResult> GetDirectoryDistricts(IParticipantCampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDirectoryDistrictsAsync(ct)));

    private static async Task<IResult> GetDirectoryCompany(Guid companyId, double? lat, double? lng, IParticipantCampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDirectoryCompanyAsync(companyId, lat, lng, ct)));

    private static async Task<IResult> AddBookmark(Guid id, IParticipantCampaignService service, CancellationToken ct)
    {
        await service.SetBookmarkAsync(id, true, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> RemoveBookmark(Guid id, IParticipantCampaignService service, CancellationToken ct)
    {
        await service.SetBookmarkAsync(id, false, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetDetail(
        Guid id,
        IParticipantCampaignService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(id, ct)));

    private static async Task<IResult> Redeem(
        Guid id,
        IParticipantCampaignService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RedeemAsync(id, ct)));
}
