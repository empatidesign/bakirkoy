using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantQuizzes;
using Nexora.Application.Features.ParticipantQuizzes.Dtos;

namespace Nexora.Api.Endpoints.Me;

public static class MeQuizEndpoints
{
    public static IEndpointRouteBuilder MapMeQuizEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/quizzes")
            .WithTags("MeQuizzes")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList);
        group.MapGet("/{id:guid}", GetDetail);
        group.MapPost("/{id:guid}/submit", Submit);
        group.MapPost("/{id:guid}/check-answer", CheckAnswer);
        group.MapGet("/{id:guid}/leaderboard", GetLeaderboard);

        return app;
    }

    private static async Task<IResult> GetList(
        [AsParameters] CitizenQuizListParams p,
        IParticipantQuizService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetListAsync(p, ct)));

    private static async Task<IResult> GetDetail(
        Guid id,
        IParticipantQuizService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetDetailAsync(id, ct)));

    private static async Task<IResult> Submit(
        Guid id,
        CitizenQuizSubmitRequest req,
        IParticipantQuizService service,
        IValidator<CitizenQuizSubmitRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new Nexora.Application.Common.Exceptions.ValidationException(validation);

        var result = await service.SubmitAsync(id, req, ct);
        return Results.Created($"/api/v1/me/quizzes/{id}/leaderboard", ApiResponse.Created(result));
    }

    private static async Task<IResult> CheckAnswer(
        Guid id,
        CitizenQuizCheckAnswerRequest req,
        IParticipantQuizService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.CheckAnswerAsync(id, req, ct)));

    private static async Task<IResult> GetLeaderboard(
        Guid id,
        string? scope,
        IParticipantQuizService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetLeaderboardAsync(id, scope, ct)));
}
