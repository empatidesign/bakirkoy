using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Seda;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class SedaPeriodRepository(AppDbContext context)
    : Repository<SedaPeriod>(context), ISedaPeriodRepository
{
    public async Task<PagedResult<SedaPeriod>> GetPagedAsync(SedaPeriodListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{term}%"));
        }

        // Kullanıcı isteği (2026-08-11): gezi/travels modülündeki HidePast deseniyle aynı —
        // bitiş tarihi geçmiş dönemler varsayılan listeden gizlenir (aktif dönem hariç, o hep
        // görünür kalır — aktif bir dönemi "geçmiş" diye gizlemek yönetici için yanıltıcı olur).
        if (p.HidePast == true)
        {
            var today = DateTime.UtcNow.Date;
            query = query.Where(x => x.IsActive || x.EndDate.Date >= today);
        }

        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<SedaPeriod> ApplySort(IQueryable<SedaPeriod> query, string? sort, string? order)
    {
        var desc = !string.Equals(order, "asc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(x => x.Name)      : query.OrderBy(x => x.Name),
            "startdate" => desc ? query.OrderByDescending(x => x.StartDate) : query.OrderBy(x => x.StartDate),
            _           => desc ? query.OrderByDescending(x => x.StartDate) : query.OrderBy(x => x.StartDate),
        };
    }

    public async Task<SedaPeriod?> GetActiveAsync(CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(x => x.IsActive, ct);

    public async Task<bool> ExistsByNameAsync(string name, Guid? excludeId, CancellationToken ct)
    {
        var normalized = name.Trim();
        return await DbSet.AnyAsync(x => EF.Functions.ILike(x.Name, LikeQuery.Escape(normalized)) && (excludeId == null || x.Id != excludeId), ct);
    }
}
