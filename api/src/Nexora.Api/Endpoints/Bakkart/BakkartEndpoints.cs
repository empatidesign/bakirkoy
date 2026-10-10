using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Bakkart;
using Nexora.Application.Features.Bakkart.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Bakkart;

public static class BakkartEndpoints
{
    public static IEndpointRouteBuilder MapBakkartEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/bakkart")
            .WithTags("Bakkart")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/applications", GetList).RequirePermission("bakkart.view");
        group.MapGet("/applications/summary", GetSummary).RequirePermission("bakkart.view");
        group.MapGet("/applications/{id:guid}", GetById).RequirePermission("bakkart.view");
        group.MapPost("/applications", Create).RequirePermission("bakkart.create");
        group.MapPatch("/applications/{id:guid}/approve", Approve).RequirePermission("bakkart.approve");
        group.MapPatch("/applications/{id:guid}/reject", Reject).RequirePermission("bakkart.approve");
        group.MapPut("/applications/{id:guid}/documents", UpdateDocuments).RequirePermission("bakkart.edit");

        group.MapGet("/cards/{cardId:guid}/transactions", GetCardTransactions).RequirePermission("bakkart.view");
        group.MapGet("/cards/{cardId:guid}/stats", GetCardStats).RequirePermission("bakkart.view");
        group.MapPost("/cards/{cardId:guid}/adjust", AdjustCard).RequirePermission("bakkart.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] BakkartApplicationListParams p, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> GetById(Guid id, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        AdminCreateBakkartApplicationRequest req,
        IBakkartService service,
        IValidator<AdminCreateBakkartApplicationRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.AdminCreateAsync(req, ct);
        return Results.Created($"/api/v1/bakkart/applications/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Approve(Guid id, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ApproveAsync(id, ct)));

    private static async Task<IResult> Reject(Guid id, RejectBakkartApplicationRequest req, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RejectAsync(id, req ?? new RejectBakkartApplicationRequest(null), ct)));

    private static async Task<IResult> UpdateDocuments(Guid id, UpdateBakkartDocumentsRequest req, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.UpdateDocumentsAsync(id, req, ct)));

    private static async Task<IResult> GetCardTransactions(Guid cardId, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetCardTransactionsAsync(cardId, ct)));

    private static async Task<IResult> GetCardStats(Guid cardId, IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetCardStatsAsync(cardId, ct)));

    private static async Task<IResult> AdjustCard(
        Guid cardId,
        AdjustBakkartCardRequest req,
        IBakkartService service,
        IValidator<AdjustBakkartCardRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.AdjustCardAsync(cardId, req, ct)));
    }
}
