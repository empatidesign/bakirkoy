using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.AppMenu;
using Nexora.Application.Features.AppMenu.Requests;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.AppMenu;

public static class AppMenuAdminEndpoints
{
    public static IEndpointRouteBuilder MapAppMenuAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/app-menu")
            .WithTags("AppMenu")
            .RequireAuthorization();

        group.MapGet("/modules", async (IAppMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetSystemModulesAsync(ct))))
            .RequirePermission("app-menu.view");

        group.MapPut("/modules/{key}", async (
            string key, UpsertSystemModuleRequest req, IValidator<UpsertSystemModuleRequest> v, IAppMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpsertSystemModuleAsync(key, req, ct)));
        })
            .RequirePermission("app-menu.manage");

        group.MapPatch("/modules/{key}/active", async (
            string key, ActiveRequest req, IAppMenuService s, CancellationToken ct) =>
        {
            await s.SetModuleActiveAsync(key, req.IsActive, ct);
            return Results.Ok(ApiResponse.Ok("Modül güncellendi."));
        }).RequirePermission("app-menu.manage");

        group.MapPut("/modules/reorder", async (
            ReorderSystemModulesRequest req, IAppMenuService s, CancellationToken ct) =>
        {
            await s.ReorderSystemModulesAsync(req, ct);
            return Results.Ok(ApiResponse.Ok("Sıralama güncellendi."));
        }).RequirePermission("app-menu.manage");

        group.MapGet("/sections", async (IAppMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetSectionsWithItemsAsync(ct))))
            .RequirePermission("app-menu.view");

        group.MapPost("/sections", async (
            CreateMenuSectionRequest req, IValidator<CreateMenuSectionRequest> v, IAppMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await s.CreateSectionAsync(req, ct);
            return Results.Created($"/api/v1/app-menu/sections/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("app-menu.manage");

        group.MapPut("/sections/{id:guid}", async (
            Guid id, UpdateMenuSectionRequest req, IValidator<UpdateMenuSectionRequest> v, IAppMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpdateSectionAsync(id, req, ct)));
        })
            .RequirePermission("app-menu.manage");

        group.MapDelete("/sections/{id:guid}", async (
            Guid id, IAppMenuService s, CancellationToken ct) =>
        {
            await s.DeleteSectionAsync(id, ct);
            return Results.Ok(ApiResponse.Ok("Bölüm silindi."));
        }).RequirePermission("app-menu.manage");

        group.MapPut("/sections/reorder", async (
            ReorderMenuSectionsRequest req, IAppMenuService s, CancellationToken ct) =>
        {
            await s.ReorderSectionsAsync(req, ct);
            return Results.Ok(ApiResponse.Ok("Sıralama güncellendi."));
        }).RequirePermission("app-menu.manage");

        group.MapPost("/items", async (
            CreateMenuItemRequest req, IValidator<CreateMenuItemRequest> v, IAppMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            var result = await s.CreateItemAsync(req, ct);
            return Results.Created($"/api/v1/app-menu/items/{result.Id}", ApiResponse.Created(result));
        }).RequirePermission("app-menu.manage");

        group.MapPut("/items/{id:guid}", async (
            Guid id, UpdateMenuItemRequest req, IValidator<UpdateMenuItemRequest> v, IAppMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpdateItemAsync(id, req, ct)));
        })
            .RequirePermission("app-menu.manage");

        group.MapDelete("/items/{id:guid}", async (
            Guid id, IAppMenuService s, CancellationToken ct) =>
        {
            await s.DeleteItemAsync(id, ct);
            return Results.Ok(ApiResponse.Ok("Öğe silindi."));
        }).RequirePermission("app-menu.manage");

        group.MapPut("/sections/{sectionId:guid}/items/reorder", async (
            Guid sectionId, ReorderMenuItemsRequest req, IAppMenuService s, CancellationToken ct) =>
        {
            await s.ReorderItemsAsync(sectionId, req, ct);
            return Results.Ok(ApiResponse.Ok("Sıralama güncellendi."));
        }).RequirePermission("app-menu.manage");

        return app;
    }

    private record ActiveRequest(bool IsActive);
}
