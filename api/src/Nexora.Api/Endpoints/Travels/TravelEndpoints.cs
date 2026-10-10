using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Reviews;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Travels;

public static class TravelEndpoints
{
    public static IEndpointRouteBuilder MapTravelEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travels")
            .WithTags("Travels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("travels.view");
        group.MapGet("/trash", GetTrash).RequirePermission("travels.view");
        group.MapGet("/summary", GetSummary).RequirePermission("travels.view");
        group.MapGet("/options", GetOptions).RequirePermission("travels.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("travels.view");
        group.MapPost("/", Create).RequirePermission("travels.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("travels.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("travels.delete");
        group.MapPatch("/{id:guid}/restore", Restore).RequirePermission("travels.edit");
        group.MapDelete("/{id:guid}/permanent", PermanentDelete).RequirePermission("travels.delete");
        group.MapPost("/{id:guid}/copy", Copy).RequirePermission("travels.create");
        group.MapPost("/{id:guid}/bulk-copy", BulkCopy).RequirePermission("travels.create");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("travels.edit");
        group.MapGet("/{id:guid}/audit", GetAudit).RequirePermission("travels.view");
        group.MapGet("/{id:guid}/reviews", GetReviews).RequirePermission("travels.view");
        group.MapGet("/{id:guid}/seating", GetSeating).RequirePermission("travels.view");
        group.MapGet("/{id:guid}/seating/export-word", ExportWordSeatPlan).RequirePermission("travels.view");
        group.MapPut("/{id:guid}/buses/{busId:guid}/seating", SaveSeating).RequirePermission("travels.edit");
        group.MapPost("/images", UploadImage).DisableAntiforgery().RequirePermission("travels.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] TravelListParams p, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetTrash([AsParameters] TravelListParams p, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTrashAsync(p, ct)));

    // Kullanıcı bulgusu (2026-08-07): frontend routeId gönderiyordu ama backend'de okunmuyordu
    // — bir Gezi'nin altındaki Seferler sayfasında üstteki istatistik kartları o gezi grubuna
    // özel değil, TÜM sistemin toplamını gösteriyordu. routeId eklendi (opsiyonel).
    private static async Task<IResult> GetSummary(Guid? routeId, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(routeId, ct)));

    // Bug fix (2026-08-07, kullanıcı bulgusu — "geziye kişi eklerken yeniden dene" hatası):
    // includeInactive query string'de gönderilmediğinde (frontend yalnızca true iken ekliyor,
    // bkz. travel.service.ts getOptions) ASP.NET minimal API bu parametreyi zorunlu (non-nullable
    // bool) olarak değerlendirip 500 (INTERNAL_SERVER_ERROR, "Required parameter ... was not
    // provided") fırlatıyordu. bool? + default false ile parametre isteğe bağlı hale getirildi.
    private static async Task<IResult> GetOptions(string? search, bool? includeInactive, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(search, includeInactive ?? false, ct)));

    private static async Task<IResult> GetById(Guid id, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        TravelFormRequest req, ITravelService service, IValidator<TravelFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/travels/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, TravelFormRequest req, ITravelService service, IValidator<TravelFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ITravelService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Restore(Guid id, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RestoreAsync(id, ct)));

    private static async Task<IResult> PermanentDelete(Guid id, ITravelService service, CancellationToken ct)
    {
        await service.PermanentDeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Copy(Guid id, TravelCopyRequest req, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CopyAsync(id, req, ct)));

    private static async Task<IResult> BulkCopy(Guid id, TravelBulkCopyRequest req, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.BulkCopyAsync(id, req, ct)));

    private static async Task<IResult> ToggleStatus(Guid id, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> GetAudit(Guid id, ITravelService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAuditLogAsync(id, ct)));

    private static async Task<IResult> GetReviews(Guid id, IReviewService reviewService, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await reviewService.GetTravelReviewsAdminAsync(id, ct)));

    private static async Task<IResult> GetSeating(Guid id, ITravelBusService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTravelSeatingAsync(id, ct)));

    private static async Task<IResult> ExportWordSeatPlan(Guid id, ITravelBusService service, CancellationToken ct)
    {
        var (bytes, fileName) = await service.ExportSeatPlanWordAsync(id, ct);
        return Results.File(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
    }

    private static async Task<IResult> SaveSeating(Guid id, Guid busId, SaveTravelSeatingRequest req, ITravelBusService service, CancellationToken ct)
    {
        await service.SaveTravelBusSeatingAsync(id, busId, req, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> UploadImage(IFormFile file, string? purpose, ITravelService service, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        var url = await service.UploadImageAsync(stream, file.FileName, file.ContentType, purpose, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }
}
