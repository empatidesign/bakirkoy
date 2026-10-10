using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryEndpoints
{
    public static IEndpointRouteBuilder MapLibraryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/libraries")
            .WithTags("Libraries")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("library.view");
        group.MapGet("/options", GetOptions).RequirePermission("library.view");
        group.MapGet("/overview-summary", GetOverviewSummary).RequirePermission("library.view");
        group.MapGet("/analytics", GetAnalytics).RequirePermission("library.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("library.view");
        group.MapGet("/{id:guid}/summary", GetDetailSummary).RequirePermission("library.view");
        group.MapPost("/", Create).RequirePermission("library.create");
        group.MapPost("/kroki", UploadKroki).DisableAntiforgery().RequirePermission("library.edit");
        group.MapPost("/images", UploadImage).DisableAntiforgery().RequirePermission("library.edit");
        group.MapPut("/{id:guid}", Update).RequirePermission("library.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("library.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("library.edit");

        group.MapPost("/{id:guid}/classify-template", ClassifyTemplate).RequirePermission("library.edit");
        group.MapPost("/classify-all-templates", ClassifyAllTemplates).RequirePermission("library.edit");

        group.MapPost("/validate-template", ValidateTemplate).RequirePermission("library.create");

        group.MapGet("/{id:guid}/static-qr", GetStaticQr).RequirePermission("library.edit");
        group.MapPatch("/{id:guid}/static-qr/toggle", ToggleStaticQr).RequirePermission("library.edit");
        group.MapPatch("/{id:guid}/static-qr/mode", SetStaticQrMode).RequirePermission("library.edit");
        group.MapPatch("/{id:guid}/static-qr/timing", SetStaticQrTiming).RequirePermission("library.edit");
        group.MapPost("/{id:guid}/static-qr/rotate", RotateStaticQr).RequirePermission("library.edit");

        return app;
    }

    private static async Task<IResult> GetStaticQr(Guid id, ILibraryOperationsService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.GetStaticQrAsync(id, ct)));

    private static async Task<IResult> ToggleStaticQr(Guid id, ToggleLibraryStaticQrRequest req, ILibraryOperationsService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.ToggleStaticQrAsync(id, req.Enabled, ct)));

    private static async Task<IResult> SetStaticQrMode(Guid id, SetLibraryStaticQrModeRequest req, ILibraryOperationsService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.SetStaticQrModeAsync(id, req.Mode, ct)));

    private static async Task<IResult> SetStaticQrTiming(Guid id, SetLibraryStaticQrTimingRequest req, ILibraryOperationsService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.SetStaticQrTimingAsync(id, req.MinExitSeconds, req.ReentryCooldownSeconds, ct)));

    private static async Task<IResult> RotateStaticQr(Guid id, ILibraryOperationsService svc, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await svc.RotateStaticQrAsync(id, ct)));

    private static IResult ValidateTemplate(HardwareVerificationRequest req, IHardwareVerificationService svc)
        => Results.Ok(ApiResponse.Ok(svc.Verify(req)));

    private static async Task<IResult> ClassifyTemplate(
        Guid id,
        IOperationTemplateClassifier classifier,
        ILibraryService service,
        CancellationToken ct)
    {
        var template = await classifier.ClassifyAsync(id, ct);
        return Results.Ok(ApiResponse.Ok(new { libraryId = id, operationTemplate = template }));
    }

    private static async Task<IResult> ClassifyAllTemplates(
        IOperationTemplateClassifier classifier,
        CancellationToken ct)
    {
        var count = await classifier.ClassifyAllAsync(ct);
        return Results.Ok(ApiResponse.Ok(new { classifiedCount = count }));
    }

    private static async Task<IResult> GetList(
        [AsParameters] LibraryListParams p,
        ILibraryService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(ILibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetOverviewSummary(ILibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOverviewSummaryAsync(ct)));

    private static async Task<IResult> GetAnalytics(
        [AsParameters] LibraryAnalyticsParams p,
        ILibraryService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAnalyticsAsync(p, ct)));

    private static async Task<IResult> GetById(Guid id, ILibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> GetDetailSummary(Guid id, ILibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailSummaryAsync(id, ct)));

    private static async Task<IResult> Create(
        LibraryRequest req,
        ILibraryService service,
        IValidator<LibraryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/libraries/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        LibraryRequest req,
        ILibraryService service,
        IValidator<LibraryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ILibraryService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ILibraryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> UploadKroki(IFormFile file, ILibraryService service, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ConflictException("Yüklenecek dosya bulunamadı.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var url = await service.UploadKrokiAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }

    private static async Task<IResult> UploadImage(IFormFile file, ILibraryService service, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ConflictException("Yüklenecek dosya bulunamadı.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var url = await service.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(new { url }));
    }
}
