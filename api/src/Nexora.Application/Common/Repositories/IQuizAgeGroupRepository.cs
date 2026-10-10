using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Application.Common.Repositories;

public interface IQuizAgeGroupRepository : IRepository<QuizAgeGroup>
{
    Task<PagedResult<QuizAgeGroup>> GetPagedAsync(QuizAgeGroupListParams p, CancellationToken ct);
    Task<List<QuizAgeGroup>> GetActiveAsync(CancellationToken ct);
    Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct);
}
