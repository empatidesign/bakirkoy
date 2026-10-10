namespace Nexora.Application.Features.Quizzes.Dtos;

public record QuizQuestionDto(
    Guid Id,
    Guid QuizId,
    int Order,
    string Question,
    List<string> Options,
    int CorrectAnswer,
    Guid CategoryId,
    string? CategoryName,
    string Difficulty,
    int Points,
    int TimeLimit,
    Guid? SubCategoryId = null,
    Guid? AgeGroupId = null,
    string Language = "tr",
    List<string>? Tags = null
);

public record QuizQuestionRequest(
    string Question,
    List<string> Options,
    int CorrectAnswer,
    Guid CategoryId,
    string Difficulty,
    int Points,
    int TimeLimit,
    Guid? SubCategoryId = null,
    Guid? AgeGroupId = null,
    string? Language = null,
    List<string>? Tags = null
);

public record SaveQuizQuestionsRequest(List<QuizQuestionRequest> Questions);
