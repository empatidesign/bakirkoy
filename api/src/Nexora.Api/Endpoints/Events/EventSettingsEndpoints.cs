using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Events;
using Nexora.Application.Features.Events.Dtos;

namespace Nexora.Api.Endpoints.Events;

public static class EventSettingsEndpoints
{
    public static IEndpointRouteBuilder MapEventSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/event-settings")
            .WithTags("EventSettings")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", Get).RequirePermission("events.view");
        group.MapPut("/", Save).RequirePermission("events.edit");
        group.MapGet("/image-ratios", GetImageRatios).RequirePermission("events.view");

        return app;
    }

    private static IResult GetImageRatios()
        => Results.Ok(ApiResponse.Ok(new EventImageRatioCatalogDto(
            Nexora.Infrastructure.Services.ImageSpecGuard.ActiveRatioSpecs,
            Nexora.Infrastructure.Services.ImageSpecGuard.LegacyRatioSpecs)));

    private static async Task<IResult> Get(IEventSettingsService service, CancellationToken ct)
    {
        var result = await service.GetAsync(ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> Save(EventSettingsDto dto, IEventSettingsService service, CancellationToken ct)
    {
        var result = await service.SaveAsync(dto, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }
}
