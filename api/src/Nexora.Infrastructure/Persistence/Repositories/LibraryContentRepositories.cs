using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class LibraryRuleRepository(AppDbContext context) : Repository<LibraryRule>(context), ILibraryRuleRepository
{
    public async Task<PagedResult<LibraryRule>> GetPagedAsync(LibraryRuleListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => !x.IsDeleted);

        if (Guid.TryParse(p.LibraryId, out var libId))
            query = query.Where(x => x.LibraryId == libId);
        if (!string.IsNullOrWhiteSpace(p.Category))
            query = query.Where(x => x.Category == p.Category);
        if (!string.IsNullOrWhiteSpace(p.Severity))
            query = query.Where(x => x.Severity == p.Severity);
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var t = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.Title, $"%{t}%") || EF.Functions.ILike(x.Description, $"%{t}%"));
        }

        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<LibraryRuleSummaryDto> GetSummaryAsync(Guid? libraryId, CancellationToken ct)
    {
        var q = DbSet.Where(x => !x.IsDeleted);
        if (libraryId is not null) q = q.Where(x => x.LibraryId == libraryId);
        var total = await q.CountAsync(ct);
        var active = await q.CountAsync(x => x.IsActive, ct);
        return new LibraryRuleSummaryDto(total, active, total - active);
    }

    private static IQueryable<LibraryRule> ApplySort(IQueryable<LibraryRule> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "title" => desc ? query.OrderByDescending(x => x.Title) : query.OrderBy(x => x.Title),
            "category" => desc ? query.OrderByDescending(x => x.Category) : query.OrderBy(x => x.Category),
            "isactive" => desc ? query.OrderByDescending(x => x.IsActive) : query.OrderBy(x => x.IsActive),
            _ => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}
