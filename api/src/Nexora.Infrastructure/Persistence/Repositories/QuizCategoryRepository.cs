using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Quizzes.Dtos;
using Nexora.Domain.Entities.Quizzes;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class QuizCategoryRepository(AppDbContext context)
    : Repository<QuizCategory>(context), IQuizCategoryRepository
{
    public async Task<PagedResult<QuizCategory>> GetPagedAsync(QuizCategoryListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, $"%{term}%") ||
                (c.Description != null && EF.Functions.ILike(c.Description, $"%{term}%")));
        }

        if (p.IsActive.HasValue)
            query = query.Where(c => c.IsActive == p.IsActive.Value);

        if (p.ParentId.HasValue)
            query = query.Where(c => c.ParentId == p.ParentId.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<bool> HasChildrenAsync(Guid parentId, CancellationToken ct)
        => await DbSet.AnyAsync(c => c.ParentId == parentId, ct);

    private static IQueryable<QuizCategory> ApplySort(IQueryable<QuizCategory> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(c => c.Name)      : query.OrderBy(c => c.Name),
            "isactive"  => desc ? query.OrderByDescending(c => c.IsActive)  : query.OrderBy(c => c.IsActive),
            "createdat" => desc ? query.OrderByDescending(c => c.CreatedAt) : query.OrderBy(c => c.CreatedAt),
            _           => query.OrderBy(c => c.Name),
        };
    }

    public async Task<List<QuizCategory>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(c => c.IsActive).OrderBy(c => c.Name).ToListAsync(ct);

    public async Task<List<QuizCategory>> GetByIdsAsync(List<Guid> ids, CancellationToken ct)
        => await DbSet.Where(c => ids.Contains(c.Id)).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(
            c => EF.Functions.ILike(c.Name, LikeQuery.Escape(normalized)) && (excludeId == null || c.Id != excludeId),
            ct);
    }
}
