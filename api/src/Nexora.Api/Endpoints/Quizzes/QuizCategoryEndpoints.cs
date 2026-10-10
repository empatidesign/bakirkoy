using Nexora.Api.Common;
using FluentValidation;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes;
using Nexora.Application.Features.Quizzes.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Quizzes;

public static class QuizCategoryEndpoints
{
    public static IEndpointRouteBuilder MapQuizCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/quiz-categories")
            .WithTags("QuizCategories")
            .RequireAuthorization("AdminOrAbove");

        group.MapGet("/", GetList).RequirePermission("quiz.view");
        group.MapGet("/options", GetOptions).RequirePermission("quiz.view");
        group.MapGet("/summary", GetSummary).RequirePermission("quiz.view");
        group.MapPost("/", Create).RequirePermission("quiz.create");
        group.MapPut("/{id:guid}", Update).RequirePermission("quiz.edit");
        group.MapDelete("/{id:guid}", Delete).RequirePermission("quiz.delete");
        group.MapPatch("/{id:guid}/toggle-status", ToggleStatus).RequirePermission("quiz.edit");

        return app;
    }

    private static async Task<IResult> GetList([AsParameters] QuizCategoryListParams p, IQuizCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetPagedAsync(p, ct)));

    private static async Task<IResult> GetOptions(IQuizCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetOptionsAsync(ct)));

    private static async Task<IResult> GetSummary(IQuizCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetSummaryAsync(ct)));

    private static async Task<IResult> Create(
        CreateQuizCategoryRequest req,
        IQuizCategoryService service,
        IValidator<CreateQuizCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/quiz-categories/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateQuizCategoryRequest req,
        IQuizCategoryService service,
        IValidator<UpdateQuizCategoryRequest> validator,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid) throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }

    private static async Task<IResult> Delete(Guid id, IQuizCategoryService service, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Results.Ok(ApiResponse.NoContent());
    }

    private static async Task<IResult> ToggleStatus(Guid id, IQuizCategoryService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.ToggleStatusAsync(id, ct)));
}
