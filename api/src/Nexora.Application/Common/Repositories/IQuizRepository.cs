using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Application.Common.Repositories;

public interface IQuizRepository : IRepository<Quiz>
{
    Task<PagedResult<Quiz>> GetPagedAsync(QuizListParams p, CancellationToken ct);
    Task<Quiz?> GetIncludingArchivedAsync(Guid id, CancellationToken ct);
    Task<List<Quiz>> GetForOptionsAsync(CancellationToken ct);

    Task<Dictionary<Guid, int>> CountByCategoriesAsync(List<Guid> categoryIds, CancellationToken ct);
    Task<int> CountByCategoryAsync(Guid categoryId, CancellationToken ct);
    Task<Dictionary<Guid, int>> CountByAgeGroupsAsync(List<Guid> ageGroupIds, CancellationToken ct);
    Task<int> CountByAgeGroupAsync(Guid ageGroupId, CancellationToken ct);

    Task<Dictionary<Guid, int>> ParticipantCountsAsync(List<Guid> quizIds, CancellationToken ct);

    Task<List<QuizQuestion>> GetQuestionsAsync(Guid quizId, CancellationToken ct);
    Task ReplaceQuestionsAsync(Guid quizId, IEnumerable<QuizQuestion> questions, CancellationToken ct);

    Task<PagedResult<QuizParticipation>> GetParticipantsAsync(Guid quizId, QuizParticipantListParams p, CancellationToken ct);
    Task<QuizParticipation?> GetParticipationAsync(Guid quizId, Guid participationId, CancellationToken ct);
    Task<List<QuizParticipation>> GetRankedParticipationsAsync(Guid quizId, CancellationToken ct);
    Task<List<QuizParticipation>> GetRankedByAgeGroupAsync(Guid quizId, Guid ageGroupId, CancellationToken ct);
    Task<List<QuizParticipation>> GetRankedByCategoryAsync(Guid categoryId, CancellationToken ct);

    Task<(int Total, int Upcoming, int Ongoing, int Completed, int Active, int Passive)> GetSummaryCountsAsync(CancellationToken ct);
    Task<(int TotalParticipants, int AverageScore)> GetParticipationSummaryAsync(CancellationToken ct);

    Task HardDeleteAsync(Quiz quiz, CancellationToken ct);

    Task<bool> ParticipationExistsAsync(Guid quizId, string tckn, CancellationToken ct);
    Task<HashSet<Guid>> GetParticipatedQuizIdsAsync(IReadOnlyCollection<Guid> quizIds, string tckn, CancellationToken ct);
    Task AddParticipationAsync(QuizParticipation participation, CancellationToken ct);
    Task RemoveParticipationAsync(Guid quizId, string tckn, CancellationToken ct);

    Task<List<string>> GetParticipantTcknsByQuizzesAsync(IReadOnlyCollection<Guid> quizIds, CancellationToken ct);
    Task<List<string>> GetParticipantTcknsByParticipationIdsAsync(IReadOnlyCollection<Guid> participationIds, CancellationToken ct);
    Task<List<QuizParticipation>> GetParticipationsByQuizIdsAsync(IReadOnlyCollection<Guid> quizIds, CancellationToken ct);
    Task<List<QuizParticipation>> GetParticipationsByIdsAsync(IReadOnlyCollection<Guid> participationIds, CancellationToken ct);
}
