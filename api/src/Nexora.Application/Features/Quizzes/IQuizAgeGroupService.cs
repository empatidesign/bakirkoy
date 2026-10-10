using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes;

public interface IQuizAgeGroupService
{
    Task<PagedResult<QuizAgeGroupDto>> GetPagedAsync(QuizAgeGroupListParams p, CancellationToken ct);
    Task<List<QuizAgeGroupOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<QuizAgeGroupSummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<QuizAgeGroupDto> CreateAsync(CreateQuizAgeGroupRequest req, CancellationToken ct);
    Task<QuizAgeGroupDto> UpdateAsync(Guid id, UpdateQuizAgeGroupRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<QuizAgeGroupDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
