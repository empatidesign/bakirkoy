using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Libraries;
using Nexora.Application.Features.Libraries.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Libraries;

public static class LibraryApplicationEndpoints
{
    public static IEndpointRouteBuilder MapLibraryApplicationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/library-applications")
            .WithTags("Libraries")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("library.view");
        group.MapGet("/summary", GetSummary).RequirePermission("library.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("library.view");
        group.MapPost("/", Create).RequirePermission("library.create");
        group.MapPost("/{id:guid}/approve", Approve).RequirePermission("library.edit");
        group.MapPost("/{id:guid}/reject", Reject).RequirePermission("library.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("library.delete");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] LibraryApplicationListParams p, ILibraryApplicationService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetSummary(ILibraryApplicationService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetSummaryAsync(ct)));

    private static async Task<IResult> GetById(Guid id, ILibraryApplicationService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(LibraryApplicationRequest req, ILibraryApplicationService s, IValidator<LibraryApplicationRequest> validator, CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var r = await s.CreateAsync(req, ct);
        return Results.Created($"/api/v1/library-applications/{r.Id}", ApiResponse.Created(r));
    }

    private static async Task<IResult> Approve(Guid id, ILibraryApplicationService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.ApproveAsync(id, ct)));

    private static async Task<IResult> Reject(Guid id, ILibraryApplicationService s, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await s.RejectAsync(id, ct)));

    private static async Task<IResult> Delete(Guid id, ILibraryApplicationService s, CancellationToken ct)
    {
        await s.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }
}
