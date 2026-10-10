using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Libraries.Dtos;
using Nexora.Domain.Entities.Libraries;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class LibraryApplicationRepository(AppDbContext context) : Repository<LibraryApplication>(context), ILibraryApplicationRepository
{
    public async Task<PagedResult<LibraryApplication>> GetPagedAsync(LibraryApplicationListParams p, IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (scopedLibraryIds is not null)
            query = query.Where(a => a.LibraryId.HasValue && scopedLibraryIds.Contains(a.LibraryId.Value));

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(a => EF.Functions.ILike(a.ApplicantName, $"%{term}%") 
                || EF.Functions.ILike(a.ApplicantSurname, $"%{term}%")
                || (a.Email != null && EF.Functions.ILike(a.Email, $"%{term}%")));
        }

        if (!string.IsNullOrWhiteSpace(p.Status))
            query = query.Where(a => a.Status == p.Status);

        if (!string.IsNullOrWhiteSpace(p.MembershipType))
            query = query.Where(a => a.MembershipType == p.MembershipType);

        if (p.LibraryId.HasValue)
            query = query.Where(a => a.LibraryId == p.LibraryId.Value);

        var desc = string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase);
        query = (p.Sort?.ToLowerInvariant()) switch
        {
            "name" => desc ? query.OrderByDescending(a => a.ApplicantName) : query.OrderBy(a => a.ApplicantName),
            "status" => desc ? query.OrderByDescending(a => a.Status) : query.OrderBy(a => a.Status),
            "createdat" => desc ? query.OrderByDescending(a => a.CreatedAt) : query.OrderBy(a => a.CreatedAt),
            _ => query.OrderByDescending(a => a.CreatedAt),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<(int Total, int Pending, int Approved, int Rejected)> GetSummaryAsync(IReadOnlyCollection<Guid>? scopedLibraryIds, CancellationToken ct)
    {
        var baseQuery = DbSet.AsQueryable();
        if (scopedLibraryIds is not null)
            baseQuery = baseQuery.Where(a => a.LibraryId.HasValue && scopedLibraryIds.Contains(a.LibraryId.Value));

        var total = await baseQuery.CountAsync(ct);
        var pending = await baseQuery.CountAsync(a => a.Status == "pending", ct);
        var approved = await baseQuery.CountAsync(a => a.Status == "approved", ct);
        var rejected = await baseQuery.CountAsync(a => a.Status == "rejected", ct);
        return (total, pending, approved, rejected);
    }
}
