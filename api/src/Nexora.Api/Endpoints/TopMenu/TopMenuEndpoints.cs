using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.TopMenu;
using Nexora.Application.Features.TopMenu.Requests;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.TopMenu;

public static class TopMenuEndpoints
{
    public static IEndpointRouteBuilder MapTopMenuEndpoints(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/api/v1/top-menu")
            .WithTags("TopMenu")
            .RequireAuthorization();

        admin.MapGet("/", async (ITopMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetAllAsync(ct))))
            .RequirePermission("app-menu.view");

        admin.MapPost("/", async (CreateTopMenuItemRequest req, IValidator<CreateTopMenuItemRequest> v, ITopMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.CreateAsync(req, ct)));
        })
            .RequirePermission("app-menu.manage");

        admin.MapPut("/{id:guid}", async (Guid id, UpdateTopMenuItemRequest req, IValidator<UpdateTopMenuItemRequest> v, ITopMenuService s, CancellationToken ct) =>
        {
            var validation = await v.ValidateAsync(req, ct);
            if (!validation.IsValid) throw new AppValidationException(validation);
            return Results.Ok(ApiResponse.Ok(await s.UpdateAsync(id, req, ct)));
        })
            .RequirePermission("app-menu.manage");

        admin.MapDelete("/{id:guid}", async (Guid id, ITopMenuService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.Ok(ApiResponse.Ok("Silindi."));
        }).RequirePermission("app-menu.manage");

        admin.MapPut("/reorder", async (ReorderTopMenuItemsRequest req, ITopMenuService s, CancellationToken ct) =>
        {
            await s.ReorderAsync(req, ct);
            return Results.Ok(ApiResponse.Ok("Sıralama güncellendi."));
        }).RequirePermission("app-menu.manage");

        app.MapGet("/api/v1/public/top-menu", async (ITopMenuService s, CancellationToken ct)
            => Results.Ok(ApiResponse.Ok(await s.GetPublicAsync(ct))))
            .WithTags("TopMenu");

        return app;
    }
}
