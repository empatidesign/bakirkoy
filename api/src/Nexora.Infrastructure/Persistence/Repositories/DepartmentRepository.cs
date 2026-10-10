using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Departments.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Organization;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class DepartmentRepository(AppDbContext context)
    : Repository<Department>(context), IDepartmentRepository
{
    public async Task<PagedResult<Department>> GetPagedAsync(DepartmentListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(d =>
                EF.Functions.ILike(d.Name, $"%{term}%") ||
                (d.Description != null && EF.Functions.ILike(d.Description, $"%{term}%")));
        }

        if (p.IsActive.HasValue)
            query = query.Where(d => d.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<Department> ApplySort(IQueryable<Department> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"        => desc ? query.OrderByDescending(d => d.Name)        : query.OrderBy(d => d.Name),
            "description" => desc ? query.OrderByDescending(d => d.Description) : query.OrderBy(d => d.Description),
            "isactive"    => desc ? query.OrderByDescending(d => d.IsActive)   : query.OrderBy(d => d.IsActive),
            "createdat"   => desc ? query.OrderByDescending(d => d.CreatedAt)  : query.OrderBy(d => d.CreatedAt),
            _             => query.OrderBy(d => d.Name),
        };
    }

    public async Task<List<Department>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(d => d.IsActive).OrderBy(d => d.Name).ToListAsync(ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(
            d => EF.Functions.ILike(d.Name, LikeQuery.Escape(normalized)) && (excludeId == null || d.Id != excludeId),
            ct);
    }
}
