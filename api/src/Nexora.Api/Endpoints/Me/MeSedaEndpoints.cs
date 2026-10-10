using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Seda;
using Nexora.Application.Features.Seda.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeSedaEndpoints
{
    public static IEndpointRouteBuilder MapMeSedaEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/seda")
            .WithTags("MeSeda")
            .RequireAuthorization("Citizen");

        group.MapGet("/info", GetInfo);
        group.MapGet("/options", GetOptions);
        group.MapGet("/applications", GetMyApplications);
        group.MapGet("/my-result", GetMyResult);
        group.MapGet("/my-results", GetMyResults);
        group.MapPost("/apply", Apply);
        group.MapDelete("/applications/{id:guid}", CancelApplication);

        return app;
    }

    private static async Task<IResult> GetInfo(IMeSedaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetInfoAsync(ct)));

    private static async Task<IResult> GetOptions(IMeSedaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetMyApplications(
        int? page, int? limit,
        IMeSedaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyApplicationsAsync(page is > 0 ? page.Value : 1, limit is > 0 ? limit.Value : 25, ct)));

    private static async Task<IResult> GetMyResult(IMeSedaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyResultAsync(ct)));

    private static async Task<IResult> GetMyResults(IMeSedaService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMyResultsAsync(ct)));

    private static async Task<IResult> CancelApplication(
        Guid id, IMeSedaService service, CancellationToken ct)
    {
        await service.CancelApplicationAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Apply(
        CitizenSedaApplyRequest req,
        IMeSedaService service,
        IValidator<CitizenSedaApplyRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new Nexora.Application.Common.Exceptions.ValidationException(validation);

        var result = await service.ApplyAsync(req, ct);
        return Results.Created($"/api/v1/me/seda/applications/{result.Id}", ApiResponse.Created(result));
    }
}
