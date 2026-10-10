namespace Nexora.Application.Features.Quizzes.Dtos;

public record QuizParticipationDto(
    Guid Id,
    Guid QuizId,
    string ParticipantName,
    string Tckn,
    int Score,
    int TotalQuestions,
    int CorrectAnswers,
    int WrongAnswers,
    int SuccessRate,
    int TimeSpent,
    DateTime CompletedAt
);

public record QuizAnswerDetailDto(
    int Order,
    string Question,
    List<string> Options,
    int SelectedAnswer,
    int CorrectAnswer,
    bool IsCorrect,
    int TimeSpent,
    int Points,
    bool IsPassed
);

public record QuizParticipationDetailDto(
    Guid Id,
    Guid QuizId,
    string ParticipantName,
    string Tckn,
    int Score,
    int TotalQuestions,
    int CorrectAnswers,
    int WrongAnswers,
    int SuccessRate,
    int TimeSpent,
    DateTime CompletedAt,
    int Rank,
    int TotalParticipants,
    List<QuizAnswerDetailDto> Answers
);

public record QuizRankingDto(
    int Rank,
    string ParticipantName,
    string Tckn,
    int Score,
    int CorrectAnswers,
    int TotalQuestions,
    int TimeSpent,
    DateTime CompletedAt
);

public record QuizLeaderboardDto(
    Guid QuizId,
    int TotalParticipants,
    int QuestionCount,
    List<QuizRankingDto> Rankings
);

public record QuizOptionStatDto(
    string Option,
    int Count,
    bool IsCorrect
);

public record QuizQuestionStatDto(
    int Order,
    string Question,
    List<string> Options,
    int CorrectAnswer,
    int TotalAnswered,
    int CorrectCount,
    int WrongCount,
    int SkippedCount,
    List<QuizOptionStatDto> OptionBreakdown
);

public record QuizStatsDto(
    Guid QuizId,
    int TotalParticipants,
    List<QuizQuestionStatDto> Questions
);
