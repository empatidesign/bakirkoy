using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes.Dtos;

namespace Nexora.Application.Features.Quizzes;

public interface IQuizCategoryService
{
    Task<PagedResult<QuizCategoryDto>> GetPagedAsync(QuizCategoryListParams p, CancellationToken ct);
    Task<List<QuizCategoryOptionDto>> GetOptionsAsync(CancellationToken ct);
    Task<QuizCategorySummaryDto> GetSummaryAsync(CancellationToken ct);
    Task<QuizCategoryDto> CreateAsync(CreateQuizCategoryRequest req, CancellationToken ct);
    Task<QuizCategoryDto> UpdateAsync(Guid id, UpdateQuizCategoryRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<QuizCategoryDto> ToggleStatusAsync(Guid id, CancellationToken ct);
}
