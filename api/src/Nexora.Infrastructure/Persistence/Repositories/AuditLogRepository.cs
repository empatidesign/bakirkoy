using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.AuditLogs.Dtos;
using Nexora.Domain.Entities.Specialized;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class AuditLogRepository(AppDbContext context)
    : Repository<AuditLog>(context), IAuditLogRepository
{
    public async Task<PagedResult<AuditLog>> GetPagedAsync(AuditLogListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(a =>
                (a.UserName != null && EF.Functions.ILike(a.UserName, $"%{term}%")) ||
                (a.Description != null && EF.Functions.ILike(a.Description, $"%{term}%")) ||
                EF.Functions.ILike(a.EntityType, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Action) && Enum.TryParse<AuditAction>(p.Action, true, out var action))
            query = query.Where(a => a.Action == action);

        if (!string.IsNullOrWhiteSpace(p.Result) && Enum.TryParse<LogResult>(p.Result, true, out var result))
            query = query.Where(a => a.Result == result);

        if (!string.IsNullOrWhiteSpace(p.Module))
            query = query.Where(a => a.Module == p.Module);

        if (!string.IsNullOrWhiteSpace(p.EntityType))
            query = query.Where(a => a.EntityType == p.EntityType);

        if (p.DateFrom.HasValue)
            query = query.Where(a => a.CreatedAt >= p.DateFrom.Value);
        if (p.DateTo.HasValue)
            query = query.Where(a => a.CreatedAt < p.DateTo.Value.AddDays(1));

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<(List<string> Modules, List<string> EntityTypes)> GetFilterOptionsAsync(CancellationToken ct)
    {
        var modules = await DbSet.AsNoTracking().Where(a => a.Module != null && a.Module != "")
            .Select(a => a.Module!).Distinct().OrderBy(m => m).ToListAsync(ct);
        var entityTypes = await DbSet.AsNoTracking().Where(a => a.EntityType != "")
            .Select(a => a.EntityType).Distinct().OrderBy(e => e).ToListAsync(ct);
        return (modules, entityTypes);
    }

    private static IQueryable<AuditLog> ApplySort(IQueryable<AuditLog> query, string? sort, string? order)
    {
        var desc = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "username"  => desc ? query.OrderByDescending(a => a.UserName).ThenByDescending(a => a.CreatedAt) : query.OrderBy(a => a.UserName).ThenBy(a => a.CreatedAt),
            "action"    => desc ? query.OrderByDescending(a => a.Action).ThenByDescending(a => a.CreatedAt)   : query.OrderBy(a => a.Action).ThenBy(a => a.CreatedAt),
            "module"    => desc ? query.OrderByDescending(a => a.Module).ThenByDescending(a => a.CreatedAt)   : query.OrderBy(a => a.Module).ThenBy(a => a.CreatedAt),
            "createdat" or "date" => desc ? query.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id) : query.OrderBy(a => a.CreatedAt).ThenBy(a => a.Id),
            _           => desc ? query.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id) : query.OrderBy(a => a.CreatedAt).ThenBy(a => a.Id),
        };
    }
}
