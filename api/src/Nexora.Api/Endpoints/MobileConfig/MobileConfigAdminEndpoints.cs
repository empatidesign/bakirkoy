using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.MobileConfig;
using Nexora.Application.Features.MobileConfig.Dtos;
using Nexora.Domain.Entities.MobileConfig;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.MobileConfig;

public static class MobileConfigAdminEndpoints
{
    public static IEndpointRouteBuilder MapMobileConfigAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/mobile-config")
            .WithTags("MobileConfig")
            .RequireAuthorization();

        group.MapGet("/", async (IMobileConfigService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetAdminAsync(ct))))
            .RequirePermission("mobile-config.view");

        group.MapPut("/webview", async (
            UpdateMobileWebViewRequest req,
            IMobileConfigService s,
            IValidator<UpdateMobileWebViewRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateWebViewAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPut("/version-control", async (
            UpdateVersionControlRequest req,
            IMobileConfigService s,
            IValidator<UpdateVersionControlRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateVersionControlAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPut("/splash-image", async (
            UpdateSplashImageRequest req,
            IMobileConfigService s,
            IValidator<UpdateSplashImageRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateSplashImageAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPost("/splash-image/upload", async (
            IFormFile file,
            IMobileConfigService s,
            CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                return Results.BadRequest(ApiResponse.Fail(400, "Görsel zorunludur.", "VALIDATION_ERROR"));

            await using var stream = file.OpenReadStream();
            var url = await s.UploadSplashImageAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(new { url }));
        }).DisableAntiforgery().RequirePermission("mobile-config.manage");

        group.MapPut("/home-logo", async (
            UpdateMobileLogoRequest req,
            IMobileConfigService s,
            IValidator<UpdateMobileLogoRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateHomeLogoAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPut("/tabbar-logo", async (
            UpdateMobileLogoRequest req,
            IMobileConfigService s,
            IValidator<UpdateMobileLogoRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateTabBarLogoAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPost("/logo/upload", async (
            IFormFile file,
            IMobileConfigService s,
            CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                return Results.BadRequest(ApiResponse.Fail(400, "Görsel zorunludur.", "VALIDATION_ERROR"));

            await using var stream = file.OpenReadStream();
            var url = await s.UploadLogoAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(new { url }));
        }).DisableAntiforgery().RequirePermission("mobile-config.manage");

        group.MapPut("/onboarding-images", async (
            UpdateOnboardingImagesRequest req,
            IMobileConfigService s,
            IValidator<UpdateOnboardingImagesRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateOnboardingImagesAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPost("/onboarding-images/upload", async (
            IFormFile file,
            IMobileConfigService s,
            CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                return Results.BadRequest(ApiResponse.Fail(400, "Görsel zorunludur.", "VALIDATION_ERROR"));

            await using var stream = file.OpenReadStream();
            var url = await s.UploadOnboardingImageAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(new { url }));
        }).DisableAntiforgery().RequirePermission("mobile-config.manage");

        group.MapPut("/legal-documents", async (
            UpdateLegalDocumentsRequest req,
            IMobileConfigService s,
            IValidator<UpdateLegalDocumentsRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpdateLegalDocumentsAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        // ---- Hızlı işlem kartları ----

        group.MapGet("/quick-actions", async (IMobileConfigService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetQuickActionsAsync(ct))))
            .RequirePermission("mobile-config.view");

        // Panelin hedef açılır listesi. Kodla birlikte değiştiği için sabit
        // liste panele gömülmez, buradan okunur.
        group.MapGet("/quick-actions/targets", ()
            => Results.Ok(ApiResponse.Ok(new
            {
                targets = MobileQuickActionTargets.All,
                maxActiveCount = MobileQuickAction.MaxActiveCount,
                appScreens = MobileAppScreens.All,
            })))
            .RequirePermission("mobile-config.view");

        group.MapPost("/quick-actions", async (
            SaveMobileQuickActionRequest req,
            IMobileConfigService s,
            IValidator<SaveMobileQuickActionRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.CreateQuickActionAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapPut("/quick-actions/{id:guid}", async (
            Guid id,
            SaveMobileQuickActionRequest req,
            IMobileConfigService s,
            IValidator<SaveMobileQuickActionRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.UpdateQuickActionAsync(id, req, ct)));
        }).RequirePermission("mobile-config.manage");

        group.MapDelete("/quick-actions/{id:guid}", async (
            Guid id, IMobileConfigService s, CancellationToken ct) =>
        {
            await s.DeleteQuickActionAsync(id, ct);
            return Results.Ok(ApiResponse.Ok(new { deleted = true }));
        }).RequirePermission("mobile-config.manage");

        group.MapPut("/quick-actions/reorder", async (
            ReorderMobileQuickActionsRequest req,
            IMobileConfigService s,
            IValidator<ReorderMobileQuickActionsRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);

            return Results.Ok(ApiResponse.Ok(await s.ReorderQuickActionsAsync(req, ct)));
        }).RequirePermission("mobile-config.manage");

        return app;
    }
}
