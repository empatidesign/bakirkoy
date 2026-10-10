using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Application.Common.Repositories;

public interface IQuizCategoryRepository : IRepository<QuizCategory>
{
    Task<PagedResult<QuizCategory>> GetPagedAsync(QuizCategoryListParams p, CancellationToken ct);
    Task<List<QuizCategory>> GetActiveAsync(CancellationToken ct);
    Task<List<QuizCategory>> GetByIdsAsync(List<Guid> ids, CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
    Task<bool> HasChildrenAsync(Guid parentId, CancellationToken ct);
}
