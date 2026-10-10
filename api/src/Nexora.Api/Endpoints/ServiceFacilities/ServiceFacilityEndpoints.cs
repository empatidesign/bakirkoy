using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.Facilities;
using Nexora.Application.Features.ServiceFacilities;
using Nexora.Application.Features.ServiceFacilities.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.ServiceFacilities;

public static class ServiceFacilityEndpoints
{
    public static IEndpointRouteBuilder MapServiceFacilityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/service-facilities")
            .WithTags("ServiceFacilities")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("service-facilities.view");
        group.MapGet("/options", GetOptions).RequirePermission("service-facilities.view");
        group.MapGet("/summary", GetSummary).RequirePermission("service-facilities.view");
        group.MapGet("/map-points", GetMapPoints).RequirePermission("service-facilities.view");
        group.MapGet("/service-catalog", GetServiceCatalog).RequirePermission("service-facilities.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("service-facilities.view");
        group.MapPost("/", Create).RequirePermission("service-facilities.create");
        group.MapPost("/import", Import).DisableAntiforgery().RequirePermission("service-facilities.create");
        group.MapPost("/images", UploadImage).DisableAntiforgery().RequirePermission("service-facilities.edit");
        group.MapPut("/{id:guid}", Update).RequirePermission("service-facilities.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("service-facilities.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("service-facilities.edit");

        group.MapGet("/{id:guid}/master-qr", GetMasterQr).RequirePermission("service-facilities.edit");
        group.MapPatch("/{id:guid}/master-qr/toggle", ToggleMasterQr).RequirePermission("service-facilities.edit");
        group.MapPost("/{id:guid}/master-card/rotate", RotateMasterCard).RequirePermission("service-facilities.edit");

        // Kullanıcı isteği (2026-10-04): modül bazlı toplu atama — bir hizmet tesisinin hangi
        // program modüllerinde kullanıldığını gösterir, seçilen yeni modüllere tek seferde atar.
        group.MapGet("/{id:guid}/module-usage", GetModuleUsage).RequirePermission("service-facilities.view");
        group.MapPost("/{id:guid}/module-usage", AssignModules).RequirePermission("service-facilities.edit");

        // Hata #20: RegisteredCount/WaitlistCount önbelleği periyodik (recurring) gruplarda gerçek
        // roster ile senkronize olmuyordu (Spor Salonu/Havuz/Gençlik-İzcilik Kampı/Bilim Merkezi).
        // Tüm modüllerdeki tüm aktif recurring grupları tek seferde yeniden hesaplayan admin-only
        // reconciliation endpoint'i (modül bazlı versiyonu: POST /api/v1/{module}/registrations/reconcile-counts).
        group.MapPost("/reconcile-group-counts", ReconcileAllGroupCounts).RequirePermission("service-facilities.edit");

        return app;
    }

    private static async Task<IResult> ReconcileAllGroupCounts(
        IFacilityRegistrationService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(new { updated = await service.ReconcileGroupCountsAsync(null, ct) }));

    private static async Task<IResult> GetList(
        [AsParameters] ServiceFacilityListParams p,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetSummary(
        string? search,
        string? type,
        string? locationType,
        string? status,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(
            new ServiceFacilityListParams
            {
                Search = search,
                Type = type,
                LocationType = locationType,
                Status = status,
            }, ct)));

    private static async Task<IResult> GetMapPoints(
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMapPointsAsync(ct)));

    private static async Task<IResult> GetServiceCatalog(
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetServiceCatalogAsync(ct)));

    private static async Task<IResult> GetById(
        Guid id,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        ServiceFacilityRequest req,
        IServiceFacilityService service,
        IValidator<ServiceFacilityRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/service-facilities/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        ServiceFacilityRequest req,
        IServiceFacilityService service,
        IValidator<ServiceFacilityRequest> validator,
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
        IServiceFacilityService service,
        CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(
        Guid id,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> Import(
        IFormFile? file,
        IServiceFacilityService service,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppValidationException("Doğrulama hatası.", new Dictionary<string, string[]> { ["file"] = ["Yüklenecek dosya zorunludur."] });
        if (!string.Equals(Path.GetExtension(file.FileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new AppValidationException("Doğrulama hatası.", new Dictionary<string, string[]> { ["file"] = ["Yalnızca .xlsx uzantılı dosya yüklenebilir."] });

        await using var stream = file.OpenReadStream();
        var result = await service.ImportAsync(stream, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> UploadImage(
        IFormFile file,
        IServiceFacilityService service,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ConflictException("Yüklenecek dosya bulunamadı.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var result = await service.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetMasterQr(
        Guid id,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMasterQrAsync(id, ct)));

    private static async Task<IResult> ToggleMasterQr(
        Guid id,
        ToggleMasterQrRequest req,
        IServiceFacilityService service,
        CancellationToken ct)
    {
        await service.ToggleMasterQrAsync(id, req.Enabled, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> RotateMasterCard(
        Guid id,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RotateMasterCardAsync(id, ct)));

    private static async Task<IResult> GetModuleUsage(
        Guid id,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetModuleUsageAsync(id, ct)));

    private static async Task<IResult> AssignModules(
        Guid id,
        AssignServiceFacilityModulesRequest req,
        IServiceFacilityService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.AssignModulesAsync(id, req, ct)));
}
