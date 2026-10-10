using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibrarySettingsEndpoints
{
    public static IEndpointRouteBuilder MapLibrarySettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/library-settings")
            .WithTags("Libraries")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", Get).RequirePermission("library.view");
        group.MapPut("/", Save).RequirePermission("library.edit");
        group.MapGet("/history", History).RequirePermission("library.view");

        return app;
    }

    private static async Task<IResult> Get(Guid? libraryId, ILibrarySettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync(libraryId, ct)));

    private static async Task<IResult> History(
        Guid? libraryId,
        int? limit,
        ILibrarySettingsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetHistoryAsync(libraryId, limit ?? 50, ct)));

    private static async Task<IResult> Save(
        LibrarySettingsDto dto,
        Guid? libraryId,
        ILibrarySettingsService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync(libraryId, dto, ct)));
}
