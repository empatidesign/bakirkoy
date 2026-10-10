using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Events.Dtos;
using Nexora.Domain.Entities.Events;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EventCategoryRepository(AppDbContext context)
    : Repository<EventCategory>(context), IEventCategoryRepository
{
    public async Task<PagedResult<EventCategory>> GetPagedAsync(EventCategoryListParams p, CancellationToken ct)
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

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<EventCategory> ApplySort(IQueryable<EventCategory> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"          => desc ? query.OrderByDescending(c => c.Name)          : query.OrderBy(c => c.Name),
            "defaultpoints" => desc ? query.OrderByDescending(c => c.DefaultPoints) : query.OrderBy(c => c.DefaultPoints),
            "isactive"      => desc ? query.OrderByDescending(c => c.IsActive)      : query.OrderBy(c => c.IsActive),
            "createdat"     => desc ? query.OrderByDescending(c => c.CreatedAt)     : query.OrderBy(c => c.CreatedAt),
            _               => query.OrderBy(c => c.Name),
        };
    }

    public async Task<List<EventCategory>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(c => c.IsActive).OrderBy(c => c.Name).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(
            c => EF.Functions.ILike(c.Name, LikeQuery.Escape(normalized)) && (excludeId == null || c.Id != excludeId),
            ct);
    }

    public async Task<EventCategory?> GetAnyByIdAsync(Guid id, CancellationToken ct)
        => await DbSet.IgnoreQueryFilters().FirstOrDefaultAsync(c => c.Id == id, ct);
}
