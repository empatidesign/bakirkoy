using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Quizzes;

public class QuizQuestion : BaseEntity
{
    public Guid QuizId { get; private set; }
    public int Order { get; private set; }
    public string Question { get; private set; } = string.Empty;
    public List<string> Options { get; private set; } = [];
    public int CorrectAnswer { get; private set; }
    public Guid CategoryId { get; private set; }
    public Guid? SubCategoryId { get; private set; }
    public Guid? AgeGroupId { get; private set; }
    public string Language { get; private set; } = "tr";
    public List<string> Tags { get; private set; } = [];
    public string Difficulty { get; private set; } = "kolay";
    public int Points { get; private set; }
    public int TimeLimit { get; private set; } = 30;

    public static QuizQuestion Create(
        Guid quizId, int order, string question, List<string> options, int correctAnswer,
        Guid categoryId, string difficulty, int points, int timeLimit,
        Guid? subCategoryId = null, Guid? ageGroupId = null, string? language = null, List<string>? tags = null)
        => new()
        {
            QuizId = quizId,
            Order = order,
            Question = question.Trim(),
            Options = options.Select(o => o.Trim()).ToList(),
            CorrectAnswer = correctAnswer < 0 ? 0 : correctAnswer,
            CategoryId = categoryId,
            SubCategoryId = subCategoryId,
            AgeGroupId = ageGroupId,
            Language = string.IsNullOrWhiteSpace(language) ? "tr" : language.Trim().ToLowerInvariant(),
            Tags = tags?.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).ToList() ?? [],
            Difficulty = difficulty.Trim(),
            Points = points < 0 ? 0 : points,
            TimeLimit = timeLimit < 5 ? 5 : timeLimit,
        };
}
