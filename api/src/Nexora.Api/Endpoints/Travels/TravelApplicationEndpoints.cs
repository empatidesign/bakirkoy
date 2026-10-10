using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelApplicationEndpoints
{
    public static IEndpointRouteBuilder MapTravelApplicationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travel-applications")
            .WithTags("Travels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("travels.view");
        group.MapGet("/summary", GetSummary).RequirePermission("travels.view");
        group.MapGet("/neighborhoods", GetNeighborhoods).RequirePermission("travels.view");
        group.MapGet("/export", Export).RequirePermission("travels.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("travels.view");
        group.MapPost("/", Create).RequirePermission("travels.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("travels.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("travels.delete");
        group.MapPatch("/{id:guid}/status", SetStatus).RequirePermission("travels.edit");
        group.MapPost("/bulk-tckn", BulkAddByTckn).RequirePermission("travels.create");
        group.MapPost("/send-message", SendManualMessage).RequirePermission("travels.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] TravelApplicationListParams p, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(Guid? travelId, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(travelId, ct)));

    private static async Task<IResult> GetNeighborhoods(Guid? travelId, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetNeighborhoodOptionsAsync(travelId, ct)));

    private static async Task<IResult> Export(
        string? search, Guid? travelId, string? status,
        DateTime? startDate, DateTime? endDate, string? neighborhood, string? sort, string? order,
        ITravelApplicationService service, CancellationToken ct)
    {
        var p = new TravelApplicationListParams
        {
            Page = "1", Limit = "10000",
            Search = search, TravelId = travelId, Status = status,
            StartDate = startDate, EndDate = endDate, Neighborhood = neighborhood, Sort = sort, Order = order
        };
        var (content, fileName) = await service.ExportAsync(p, ct);
        return Results.File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    private static async Task<IResult> GetById(Guid id, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        TravelApplicationFormRequest req, ITravelApplicationService service, IValidator<TravelApplicationFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/travel-applications/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, TravelApplicationFormRequest req, ITravelApplicationService service, IValidator<TravelApplicationFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ITravelApplicationService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> SetStatus(Guid id, SetApplicationStatusRequest req, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SetStatusAsync(id, req.Status, req.Reason, ct)));

    private static async Task<IResult> BulkAddByTckn(TravelBulkTcknRequest req, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.BulkAddByTcknAsync(req, ct)));

    private static async Task<IResult> SendManualMessage(TravelManualMessageRequest req, ITravelApplicationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendManualMessageAsync(req, ct)));
}
