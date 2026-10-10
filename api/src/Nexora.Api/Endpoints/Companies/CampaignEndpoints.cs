using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;

namespace Nexora.Api.Endpoints.Companies;

public static class CampaignEndpoints
{
    public static IEndpointRouteBuilder MapCampaignEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/campaigns")
            .WithTags("Campaigns")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("companies.view");
        group.MapGet("/summary", GetSummary).RequirePermission("companies.view");
        group.MapGet("/options", GetOptions).RequirePermission("companies.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("companies.view");
        group.MapPost("/", Create).RequirePermission("companies.edit");
        group.MapPut("/{id:guid}", Update).RequirePermission("companies.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("companies.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("companies.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] CampaignListParams p, ICampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        Guid? companyId,
        string? status,
        string? dateRange,
        ICampaignService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new CampaignListParams { Search = search, CompanyId = companyId, Status = status, DateRange = dateRange }, ct)));

    private static async Task<IResult> GetOptions(Guid? companyId, ICampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(companyId, ct)));

    private static async Task<IResult> GetById(Guid id, ICampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        CreateCampaignRequest req,
        ICampaignService service,
        IValidator<CreateCampaignRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new Nexora.Application.Common.Exceptions.ValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/campaigns/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateCampaignRequest req,
        ICampaignService service,
        IValidator<UpdateCampaignRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new Nexora.Application.Common.Exceptions.ValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ICampaignService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ICampaignService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
