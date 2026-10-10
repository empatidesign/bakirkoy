using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Wheels;
using Nexora.Application.Features.Wheels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Wheels;

public static class GiftEndpoints
{
    public static IEndpointRouteBuilder MapGiftEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/gifts")
            .WithTags("Gifts")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("wheel.view");
        group.MapGet("/summary", GetSummary).RequirePermission("wheel.view");
        group.MapGet("/options", GetOptions).RequirePermission("wheel.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("wheel.view");
        group.MapPost("/", Create).RequirePermission("wheel.create");
        group.MapPost("/images", UploadImage).DisableAntiforgery().RequirePermission("wheel.edit");
        group.MapPut("/{id:guid}", Update).RequirePermission("wheel.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("wheel.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("wheel.edit");

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] GiftListParams p,
        IGiftService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        string? status,
        IGiftService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new GiftListParams { Search = search, Status = status }, ct)));

    private static async Task<IResult> GetOptions(
        IGiftService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetById(
        Guid id,
        IGiftService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        GiftUpsertRequest req,
        IGiftService service,
        IValidator<GiftUpsertRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/gifts/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> UploadImage(
        IFormFile file,
        IGiftService service,
        CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var url = await service.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }

    private static async Task<IResult> Update(
        Guid id,
        GiftUpsertRequest req,
        IGiftService service,
        IValidator<GiftUpsertRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.UpdateAsync(id, req, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IGiftService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IGiftService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
