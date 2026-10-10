using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.ParticipantQuizzes.Dtos;

namespace Nexora.Application.Features.ParticipantQuizzes;

public interface IParticipantQuizService
{
    Task<PagedResult<CitizenQuizDto>> GetListAsync(CitizenQuizListParams p, CancellationToken ct);
    Task<CitizenQuizDetailDto> GetDetailAsync(Guid quizId, CancellationToken ct);
    Task<CitizenQuizSubmitResultDto> SubmitAsync(Guid quizId, CitizenQuizSubmitRequest req, CancellationToken ct);
    Task<CitizenQuizCheckAnswerResultDto> CheckAnswerAsync(Guid quizId, CitizenQuizCheckAnswerRequest req, CancellationToken ct);
    Task<CitizenQuizLeaderboardDto> GetLeaderboardAsync(Guid quizId, string? scope, CancellationToken ct);
}
