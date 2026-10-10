using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Notifications.Dtos;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes;

public interface IQuizService
{
    Task<PagedResult<QuizDto>> GetPagedAsync(QuizListParams p, CancellationToken ct);
    Task<List<QuizOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<QuizSummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<QuizDto> GetByIdAsync(Guid id, CancellationToken ct);
    Task<QuizDto> CreateAsync(CreateQuizRequest req, CancellationToken ct);
    Task<QuizDto> UpdateAsync(Guid id, UpdateQuizRequest req, CancellationToken ct);
    Task<QuizDto> ToggleStatusAsync(Guid id, CancellationToken ct);
    Task ArchiveAsync(Guid id, CancellationToken ct);
    Task<QuizDto> RestoreAsync(Guid id, CancellationToken ct);
    Task HardDeleteAsync(Guid id, CancellationToken ct);

    Task<List<QuizQuestionDto>> GetQuestionsAsync(Guid quizId, CancellationToken ct);
    Task<List<QuizQuestionDto>> SaveQuestionsAsync(Guid quizId, SaveQuizQuestionsRequest req, CancellationToken ct);

    Task<PagedResult<QuizParticipationDto>> GetParticipantsAsync(Guid quizId, QuizParticipantListParams p, CancellationToken ct);
    Task<QuizParticipationDetailDto> GetParticipationDetailAsync(Guid quizId, Guid participationId, CancellationToken ct);
    Task<QuizLeaderboardDto> GetLeaderboardAsync(Guid quizId, string? scope, CancellationToken ct);
    Task<QuizStatsDto> GetQuestionStatsAsync(Guid quizId, CancellationToken ct);
    Task<ModuleManualMessageResultDto> SendManualMessageAsync(ModuleManualMessageRequest req, CancellationToken ct);
}
