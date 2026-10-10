namespace Nexora.Application.Features.ParticipantQuizzes.Dtos;

public record CitizenQuizDto(
    Guid Id,
    string Title,
    string Description,
    string CategoryName,
    string? CategoryColor,
    string? AgeGroupName,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    int QuestionCount,
    int DurationMinutes,
    int ParticipantCount,
    bool IsActive,
    bool AlreadyParticipated);

public record CitizenQuizListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved => int.TryParse(Page, out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
}

public record CitizenQuizQuestionDto(
    Guid Id,
    int Order,
    string Question,
    List<string> Options,
    string Difficulty,
    int Points,
    int TimeLimit);

public record CitizenQuizDetailDto(
    Guid Id,
    string Title,
    string Description,
    string CategoryName,
    string? CategoryColor,
    DateTime StartDate,
    DateTime EndDate,
    string Status,
    int DurationMinutes,
    bool AlreadyParticipated,
    List<CitizenQuizQuestionDto> Questions,
    int PassRights = 0);

public record CitizenSubmitAnswerDto(int QuestionIndex, string? SelectedAnswer, int TimeSpent, bool IsPassed = false);

public record CitizenQuizSubmitRequest(
    List<CitizenSubmitAnswerDto> Answers,
    int TotalTimeSpent);

public record CitizenQuizCheckAnswerRequest(int QuestionIndex, string? SelectedAnswer);

public record CitizenQuizCheckAnswerResultDto(int QuestionIndex, bool IsCorrect);

public record CitizenQuizSubmitResultDto(
    Guid ParticipationId,
    int Score,
    int TotalQuestions,
    int CorrectAnswers,
    int WrongAnswers,
    int PassedCount,
    int SuccessRate,
    int Rank,
    int TotalParticipants,
    bool IsPassed,
    int PassingScore);

public record CitizenQuizRankingDto(
    int Rank,
    string ParticipantName,
    int Score,
    int CorrectAnswers,
    int TimeSpent,
    DateTime CompletedAt);

public record CitizenQuizLeaderboardDto(
    Guid QuizId,
    string Title,
    int TotalParticipants,
    int QuestionCount,
    List<CitizenQuizRankingDto> Rankings);
