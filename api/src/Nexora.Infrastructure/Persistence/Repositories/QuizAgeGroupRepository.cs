using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class QuizAgeGroupRepository(AppDbContext context)
    : Repository<QuizAgeGroup>(context), IQuizAgeGroupRepository
{
    public async Task<PagedResult<QuizAgeGroup>> GetPagedAsync(QuizAgeGroupListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(g => EF.Functions.ILike(g.Name, $"%{term}%"));
        }

        if (p.IsActive.HasValue)
            query = query.Where(g => g.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<QuizAgeGroup> ApplySort(IQueryable<QuizAgeGroup> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(g => g.Name)      : query.OrderBy(g => g.Name),
            "minage"    => desc ? query.OrderByDescending(g => g.MinAge)    : query.OrderBy(g => g.MinAge),
            "isactive"  => desc ? query.OrderByDescending(g => g.IsActive)  : query.OrderBy(g => g.IsActive),
            "createdat" => desc ? query.OrderByDescending(g => g.CreatedAt) : query.OrderBy(g => g.CreatedAt),
            _           => query.OrderBy(g => g.SortOrder).ThenBy(g => g.MinAge),
        };
    }

    public async Task<List<QuizAgeGroup>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(g => g.IsActive).OrderBy(g => g.SortOrder).ThenBy(g => g.MinAge).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(
            g => EF.Functions.ILike(g.Name, LikeQuery.Escape(normalized)) && (excludeId == null || g.Id != excludeId),
            ct);
    }
}
