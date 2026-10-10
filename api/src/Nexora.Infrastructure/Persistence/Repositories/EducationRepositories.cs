using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Education.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Education;
using Nexora.Infrastructure.Persistence;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class EducationInstitutionRepository(AppDbContext context)
    : Repository<EducationInstitution>(context), IEducationInstitutionRepository
{
    public async Task<PagedResult<EducationInstitution>> GetPagedAsync(EducationInstitutionListParams p, CancellationToken ct)
    {
        var query = DbSet.Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var s = LikeQuery.Escape(p.Search);
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{s}%") ||
                (x.Faculty != null && EF.Functions.ILike(x.Faculty, $"%{s}%")) ||
                (x.Department != null && EF.Functions.ILike(x.Department, $"%{s}%")));
        }

        if (!string.IsNullOrWhiteSpace(p.Name))
        {
            var n = LikeQuery.Escape(p.Name);
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{n}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Faculty))
        {
            var f = LikeQuery.Escape(p.Faculty);
            query = query.Where(x => x.Faculty != null && EF.Functions.ILike(x.Faculty, $"%{f}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Department))
        {
            var d = LikeQuery.Escape(p.Department);
            query = query.Where(x => x.Department != null && EF.Functions.ILike(x.Department, $"%{d}%"));
        }

        if (p.Type.HasValue)
            query = query.Where(x => x.Type == p.Type.Value);

        if (p.IsActive.HasValue)
            query = query.Where(x => x.IsActive == p.IsActive.Value);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<EducationInstitution>> GetActiveAsync(CancellationToken ct)
        => await DbSet.Where(x => !x.IsDeleted && x.IsActive).OrderBy(x => x.Name).ToListAsync(ct);

    private static IQueryable<EducationInstitution> ApplySort(IQueryable<EducationInstitution> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name" => desc ? query.OrderByDescending(x => x.Name) : query.OrderBy(x => x.Name),
            "type" => desc ? query.OrderByDescending(x => x.Type) : query.OrderBy(x => x.Type),
            "isactive" => desc ? query.OrderByDescending(x => x.IsActive) : query.OrderBy(x => x.IsActive),
            "createdat" => desc ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt),
            _ => query.OrderBy(x => x.Name),
        };
    }
}

public class EducationHistoryRepository(AppDbContext context)
    : Repository<EducationHistory>(context), IEducationHistoryRepository
{
    public async Task<List<EducationHistory>> GetByParticipantAsync(Guid participantId, CancellationToken ct)
        => await DbSet
            .Where(x => !x.IsDeleted && x.ParticipantId == participantId)
            .Include(x => x.Institution)
            .OrderByDescending(x => x.StartYear)
            .ToListAsync(ct);
}
