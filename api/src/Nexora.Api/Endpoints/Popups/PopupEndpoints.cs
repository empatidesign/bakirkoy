using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Popups;
using Nexora.Application.Features.Popups.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Popups;

/// <summary>
/// Kullanıcı isteği (2026-09-20): admin panelden yönetilen zorunlu/bilgilendirme popup
/// sistemi. Bir popup birden fazla resim/video/metin öğesi içerebilir, belirli bir tetikleme
/// (ilk giriş / her giriş / modüle giriş) ve zaman aralığında vatandaşa gösterilir.
/// </summary>
public static class PopupEndpoints
{
    public static IEndpointRouteBuilder MapPopupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/popups")
            .WithTags("Popups")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("popups.view");
        group.MapGet("/summary", GetSummary).RequirePermission("popups.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("popups.view");
        group.MapPost("/", Create).RequirePermission("popups.create");
        group.MapPost("/media", UploadMedia).DisableAntiforgery().RequirePermission("popups.edit");
        group.MapPut("/{id:guid}", Update).RequirePermission("popups.edit");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("popups.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("popups.delete");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] PopupListParams p, IPopupService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(IPopupService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> GetById(Guid id, IPopupService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        UpsertPopupRequest req,
        IPopupService service,
        IValidator<UpsertPopupRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/popups/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpsertPopupRequest req,
        IPopupService service,
        IValidator<UpsertPopupRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> ToggleStatus(Guid id, IPopupService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> Delete(Guid id, IPopupService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> UploadMedia(IFormFile file, IPopupService service, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var url = await service.UploadMediaAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }
}
