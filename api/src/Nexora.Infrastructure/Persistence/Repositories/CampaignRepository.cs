using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CampaignRepository(AppDbContext context)
    : Repository<Campaign>(context), ICampaignRepository
{
    public async Task<PagedResult<Campaign>> GetPagedAsync(CampaignListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.Include(x => x.Company).ThenInclude(c => c!.ServiceCategory).Include(x => x.Products).AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<CampaignSummaryDto> GetSummaryAsync(CampaignListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var total = await baseQuery.CountAsync(ct);
        var active = await baseQuery.CountAsync(x => x.Status == CampaignStatus.Active, ct);
        var completed = await baseQuery.CountAsync(x => x.Status == CampaignStatus.Completed, ct);
        var passive = await baseQuery.CountAsync(x => x.Status == CampaignStatus.Passive, ct);
        var totalUsages = await baseQuery.SumAsync(x => x.UsageCount, ct);

        return new CampaignSummaryDto(total, active, completed, passive, totalUsages);
    }

    public async Task<Campaign?> GetByIdWithCompanyAsync(Guid id, CancellationToken ct)
        => await DbSet.Include(x => x.Company).ThenInclude(c => c!.ServiceCategory).Include(x => x.Products).FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<List<Campaign>> GetActiveWithCompanyAsync(CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        return await DbSet
            .Include(x => x.Company).ThenInclude(c => c!.ServiceCategory)
            .Include(x => x.Products)
            .Where(x => x.Status == CampaignStatus.Active
                && x.EndDate.Date >= today
                && x.Company != null
                && x.Company.Status == CompanyStatus.Approved)
            .OrderByDescending(x => x.StartDate)
            .ToListAsync(ct);
    }

    public async Task<List<Campaign>> GetVisibleWithCompanyAsync(CancellationToken ct)
    {
        var today = TurkeyTime.TodayDate();
        return await DbSet
            .Include(x => x.Company).ThenInclude(c => c!.ServiceCategory)
            .Include(x => x.Products)
            .Where(x => (x.Status == CampaignStatus.Active || x.Status == CampaignStatus.Completed)
                && x.EndDate.Date >= today
                && x.Company != null
                && x.Company.Status == CompanyStatus.Approved)
            .OrderByDescending(x => x.StartDate)
            .ToListAsync(ct);
    }

    public async Task<List<Campaign>> GetOptionsAsync(Guid? companyId, CancellationToken ct)
    {
        var query = DbSet.Where(x => x.Status == CampaignStatus.Active);
        if (companyId.HasValue)
            query = query.Where(x => x.CompanyId == companyId.Value);
        return await query.OrderBy(x => x.Name).ToListAsync(ct);
    }

    public async Task<int> CountActiveByCompanyAsync(Guid companyId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.CompanyId == companyId && x.Status == CampaignStatus.Active, ct);

    public async Task<Dictionary<Guid, int>> CountVisibleByCompaniesAsync(IEnumerable<Guid> companyIds, CancellationToken ct)
    {
        var ids = companyIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        var today = TurkeyTime.TodayDate();
        var counts = await DbSet
            .Where(x => ids.Contains(x.CompanyId)
                && (x.Status == CampaignStatus.Active || x.Status == CampaignStatus.Completed)
                && x.EndDate.Date >= today
                && x.Company != null
                && x.Company.Status == CompanyStatus.Approved)
            .GroupBy(x => x.CompanyId)
            .Select(g => new { CompanyId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return counts.ToDictionary(x => x.CompanyId, x => x.Count);
    }

    private static IQueryable<Campaign> ApplyFilters(IQueryable<Campaign> query, CampaignListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x => EF.Functions.ILike(x.Name, $"%{term}%"));
        }

        if (p.CompanyId.HasValue)
            query = query.Where(x => x.CompanyId == p.CompanyId.Value);

        if (!ignoreStatus && Enum.TryParse<CampaignStatus>(p.Status, true, out var status))
            query = query.Where(x => x.Status == status);

        if (p.ServiceCategoryId.HasValue)
            query = query.Where(x => x.Company != null && x.Company.ServiceCategoryId == p.ServiceCategoryId.Value);

        if (Enum.TryParse<CampaignCategory>(p.Category, true, out var category))
            query = query.Where(x => x.Category == category);

        if (!string.IsNullOrWhiteSpace(p.DateRange))
        {
            var today = TurkeyTime.TodayDate();
            query = p.DateRange.Trim().ToLowerInvariant() switch
            {
                "active" => query.Where(x => x.StartDate <= today && x.EndDate >= today),
                "future" => query.Where(x => x.StartDate > today),
                "past"   => query.Where(x => x.EndDate < today),
                _        => query,
            };
        }

        if (p.CreatedFrom.HasValue)
            query = query.Where(x => x.CreatedAt >= p.CreatedFrom.Value);
        if (p.CreatedTo.HasValue)
            query = query.Where(x => x.CreatedAt <= p.CreatedTo.Value);

        return query;
    }

    private static IQueryable<Campaign> ApplySort(IQueryable<Campaign> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"          => desc ? query.OrderByDescending(x => x.Name)          : query.OrderBy(x => x.Name),
            "discountvalue" => desc ? query.OrderByDescending(x => x.DiscountValue) : query.OrderBy(x => x.DiscountValue),
            "usagecount"    => desc ? query.OrderByDescending(x => x.UsageCount)    : query.OrderBy(x => x.UsageCount),
            "startdate"     => desc ? query.OrderByDescending(x => x.StartDate)     : query.OrderBy(x => x.StartDate),
            "enddate"       => desc ? query.OrderByDescending(x => x.EndDate)       : query.OrderBy(x => x.EndDate),
            "status"        => desc ? query.OrderByDescending(x => x.Status)        : query.OrderBy(x => x.Status),
            "createdat"     => desc ? query.OrderByDescending(x => x.CreatedAt)     : query.OrderBy(x => x.CreatedAt),
            _               => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}
