using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Travels;

/// <summary>
/// "Gezi" (rota/lokasyon) yönetimi — ör. Çanakkale. Her Route altında birden çok
/// Sefer (Travel) açılabilir. İçerik alanları (isim, açıklama, kural, görsel, fiyat,
/// yaş/cinsiyet kısıtı) yalnızca Route üzerinden düzenlenir, Sefer bunları miras alır.
/// </summary>
public static class TravelRouteEndpoints
{
    public static IEndpointRouteBuilder MapTravelRouteEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/travel-routes")
            .WithTags("Travels")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("travels.view");
        group.MapGet("/options", GetOptions).RequirePermission("travels.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("travels.view");
        group.MapGet("/{id:guid}/travels", GetTravels).RequirePermission("travels.view");
        group.MapPost("/", Create).RequirePermission("travels.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("travels.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("travels.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("travels.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] TravelRouteListParams p, ITravelRouteService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(string? search, ITravelRouteService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(search, ct)));

    private static async Task<IResult> GetById(Guid id, ITravelRouteService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> GetTravels(Guid id, [AsParameters] TravelListParams p, ITravelRouteService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetTravelsAsync(id, p, ct)));

    private static async Task<IResult> Create(
        TravelRouteFormRequest req, ITravelRouteService service, IValidator<TravelRouteFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/travel-routes/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id, TravelRouteFormRequest req, ITravelRouteService service, IValidator<TravelRouteFormRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ITravelRouteService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ITravelRouteService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
