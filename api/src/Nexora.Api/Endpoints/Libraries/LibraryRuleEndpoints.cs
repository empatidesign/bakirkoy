using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryRuleEndpoints
{
    public static IEndpointRouteBuilder MapLibraryRuleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/library-rules")
            .WithTags("Libraries")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("library.view");
        group.MapGet("/summary", GetSummary).RequirePermission("library.view");
        group.MapPost("/", Create).RequirePermission("library.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("library.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("library.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("library.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] LibraryRuleListParams p, ILibraryRuleService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(Guid? libraryId, ILibraryRuleService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetSummaryAsync(libraryId, ct)));

    private static async Task<IResult> Create(LibraryRuleRequest req, ILibraryRuleService s, IValidator<LibraryRuleRequest> v, CancellationToken ct)
    {
        var val = await v.ValidateAsync(req, ct);
        if (!val.IsValid) throw new AppValidationException(val);
        var r = await s.CreateAsync(req, ct);
        return Results.Created($"/api/v1/library-rules/{r.Id}", ApiResponse.Created(r));
    }

    private static async Task<IResult> Update(Guid id, LibraryRuleRequest req, ILibraryRuleService s, IValidator<LibraryRuleRequest> v, CancellationToken ct)
    {
        var val = await v.ValidateAsync(req, ct);
        if (!val.IsValid) throw new AppValidationException(val);
        return Results.Ok(ApiResponse.Ok(await s.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, ILibraryRuleService s, CancellationToken ct)
    {
        await s.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, ILibraryRuleService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.ToggleStatusAsync(id, ct)));
}
