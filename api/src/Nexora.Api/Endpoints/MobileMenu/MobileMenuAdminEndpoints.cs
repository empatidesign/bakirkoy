using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.MobileMenu;
using Nexora.Application.Features.MobileMenu.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.MobileMenu;

public static class MobileMenuAdminEndpoints
{
    public static IEndpointRouteBuilder MapMobileMenuAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/mobile-menu")
            .WithTags("MobileMenu")
            .RequireAuthorization();

        group.MapGet("/items", async (IMobileMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetItemsAsync(ct))))
            .RequireAnyPermission("mobile-menu.view", "mobile-config.view");

        group.MapPost("/items", async (
            CreateMobileMenuItemRequest req, IMobileMenuService s,
            IValidator<CreateMobileMenuItemRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await s.CreateItemAsync(req, ct);
            return Results.Created($"/api/v1/mobile-menu/items/{result.Id}", ApiResponse.Created(result));
        }).RequireAnyPermission("mobile-menu.manage", "mobile-config.manage");

        group.MapPut("/items/{id:guid}", async (
            Guid id, UpdateMobileMenuItemRequest req, IMobileMenuService s,
            IValidator<UpdateMobileMenuItemRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpdateItemAsync(id, req, ct)));
        }).RequireAnyPermission("mobile-menu.manage", "mobile-config.manage");

        group.MapDelete("/items/{id:guid}", async (Guid id, IMobileMenuService s, CancellationToken ct) =>
        {
            await s.DeleteItemAsync(id, ct);
            return Results.NoContent();
        }).RequireAnyPermission("mobile-menu.manage", "mobile-config.manage");

        group.MapPut("/items/reorder", async (ReorderMobileMenuRequest req, IMobileMenuService s, CancellationToken ct) =>
        {
            await s.ReorderAsync(req, ct);
            return Results.NoContent();
        }).RequireAnyPermission("mobile-menu.manage", "mobile-config.manage");

        group.MapGet("/groups", async (IMobileMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetGroupsAsync(ct))))
            .RequireAnyPermission("mobile-menu.view", "mobile-config.view");

        group.MapGet("/banners", async (IMobileMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetBannersAsync(ct))))
            .RequirePermission("mobile-menu.view");

        group.MapPut("/banners/{pageKey}", async (
            string pageKey, UpsertBannerRequest req, IMobileMenuService s,
            IValidator<UpsertBannerRequest> v, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpsertBannerAsync(pageKey, req, ct)));
        }).RequirePermission("mobile-menu.manage");

        group.MapDelete("/banners/{pageKey}", async (string pageKey, IMobileMenuService s, CancellationToken ct) =>
        {
            await s.DeleteBannerAsync(pageKey, ct);
            return Results.NoContent();
        }).RequirePermission("mobile-menu.manage");

        group.MapPost("/images", async (IFormFile file, IMobileMenuService s, CancellationToken ct) =>
        {
            if (file is null || file.Length == 0)
                return Results.BadRequest(ApiResponse.Fail(400, "Görsel zorunludur.", "VALIDATION_ERROR"));
            await using var stream = file.OpenReadStream();
            var url = await s.UploadImageAsync(stream, file.FileName, file.ContentType, ct);
            return Results.Ok(ApiResponse.Ok(new { url }));
        }).DisableAntiforgery().RequireAnyPermission("mobile-menu.manage", "mobile-config.manage");

        return app;
    }
}
