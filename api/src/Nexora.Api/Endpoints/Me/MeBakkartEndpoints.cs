using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Bakkart;
using Nexora.Application.Features.Bakkart.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Me;

public static class MeBakkartEndpoints
{
    public static IEndpointRouteBuilder MapMeBakkartEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/bakkart")
            .WithTags("MeBakkart")
            .RequireAuthorization("Citizen");

        group.MapGet("/status", GetStatus);
        group.MapGet("/stats", GetStats);
        group.MapGet("/transactions", GetTransactions);
        group.MapPost("/apply", Apply);
        group.MapPost("/documents", UploadDocument).DisableAntiforgery();
        group.MapPost("/{id:guid}/cancel", Cancel);

        return app;
    }

    private static async Task<IResult> GetStatus(IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyStatusAsync(ct)));

    private static async Task<IResult> GetStats(IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyStatsAsync(ct)));

    private static async Task<IResult> GetTransactions(IBakkartService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyTransactionsAsync(ct)));

    private static async Task<IResult> Apply(
        CreateBakkartApplicationRequest req,
        IBakkartService service,
        IValidator<CreateBakkartApplicationRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CitizenApplyAsync(req, ct);
        return Results.Created($"/api/v1/me/bakkart/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Cancel(Guid id, IBakkartService service, CancellationToken ct)
    {
        await service.CancelMyApplicationAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> UploadDocument(IFormFile file, IBakkartService service, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new Nexora.Application.Common.Exceptions.ConflictException("Lütfen bir belge seçin.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var result = await service.UploadMyDocumentAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}
