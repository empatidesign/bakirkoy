using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Application.Features.Notifications;
using Nexora.Application.Features.Notifications.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Quizzes;

public static class QuizEndpoints
{
    public static IEndpointRouteBuilder MapQuizEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/quizzes")
            .WithTags("Quizzes")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("quiz.view");
        group.MapGet("/options", GetOptions).RequirePermission("quiz.view");
        group.MapGet("/summary", GetSummary).RequirePermission("quiz.view");
        group.MapGet("/{id:guid}", GetById).RequirePermission("quiz.view");
        group.MapPost("/", Create).RequirePermission("quiz.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("quiz.edit");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("quiz.edit");
        group.MapDelete("/{id:guid}", Archive).RequirePermission("quiz.delete");
        group.MapPatch("/{id:guid}/restore", Restore).RequirePermission("quiz.edit");
        group.MapDelete("/{id:guid}/permanent", HardDelete).RequirePermission("quiz.delete");

        group.MapGet("/{id:guid}/questions", GetQuestions).RequirePermission("quiz.view");
        group.MapPut("/{id:guid}/questions", SaveQuestions).RequirePermission("quiz.edit");

        group.MapGet("/{id:guid}/participants", GetParticipants).RequirePermission("quiz.view");
        group.MapGet("/{id:guid}/participants/{participationId:guid}", GetParticipationDetail).RequirePermission("quiz.view");
        group.MapGet("/{id:guid}/leaderboard", GetLeaderboard).RequirePermission("quiz.view");
        group.MapGet("/{id:guid}/question-stats", GetQuestionStats).RequirePermission("quiz.view");
        group.MapPost("/messages/send", SendMessage).RequirePermission("quiz.edit");

        var settingsGroup = app.MapGroup("/api/v1/quiz")
            .WithTags("Quizzes")
            .RequireAuthorization("AdminOrAbove");
        settingsGroup.MapGet("/notification-settings", GetNotificationSettings).RequirePermission("quiz.view");
        settingsGroup.MapPut("/notification-settings", SaveNotificationSettings).RequirePermission("quiz.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] QuizListParams p, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetSummary(IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> GetById(Guid id, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetByIdAsync(id, ct)));

    private static async Task<IResult> Create(
        CreateQuizRequest req,
        IQuizService service,
        IValidator<CreateQuizRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/quizzes/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateQuizRequest req,
        IQuizService service,
        IValidator<UpdateQuizRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> ToggleStatus(Guid id, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));

    private static async Task<IResult> Archive(Guid id, IQuizService service, CancellationToken ct)
    {
        await service.ArchiveAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> Restore(Guid id, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.RestoreAsync(id, ct)));

    private static async Task<IResult> HardDelete(Guid id, IQuizService service, CancellationToken ct)
    {
        await service.HardDeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> GetQuestions(Guid id, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetQuestionsAsync(id, ct)));

    private static async Task<IResult> SaveQuestions(
        Guid id,
        SaveQuizQuestionsRequest req,
        IQuizService service,
        IValidator<SaveQuizQuestionsRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.SaveQuestionsAsync(id, req, ct)));
    }

    private static async Task<IResult> GetParticipants(
        Guid id,
        [AsParameters] QuizParticipantListParams p,
        IQuizService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetParticipantsAsync(id, p, ct)));

    private static async Task<IResult> GetParticipationDetail(Guid id, Guid participationId, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetParticipationDetailAsync(id, participationId, ct)));

    private static async Task<IResult> GetLeaderboard(Guid id, string? scope, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetLeaderboardAsync(id, scope, ct)));

    private static async Task<IResult> GetQuestionStats(Guid id, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetQuestionStatsAsync(id, ct)));

    private static async Task<IResult> SendMessage(ModuleManualMessageRequest req, IQuizService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SendManualMessageAsync(req, ct)));

    private static async Task<IResult> GetNotificationSettings(IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetAsync("quiz", ct)));

    private static async Task<IResult> SaveNotificationSettings(ModuleNotificationSettingsDto req, IModuleNotificationSettingsService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.SaveAsync("quiz", req, ct)));
}
