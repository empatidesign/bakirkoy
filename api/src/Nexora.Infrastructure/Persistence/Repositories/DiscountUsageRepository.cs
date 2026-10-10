using Microsoft.EntityFrameworkCore;
using Nexora.Domain.Common;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class DiscountUsageRepository(AppDbContext context)
    : Repository<DiscountUsage>(context), IDiscountUsageRepository
{
    public async Task<PagedResult<DiscountUsage>> GetPagedAsync(DiscountUsageListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.Include(x => x.Campaign).ThenInclude(c => c!.Company).AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<DiscountUsageSummaryDto> GetSummaryAsync(DiscountUsageListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var total = await baseQuery.CountAsync(ct);
        var used = await baseQuery.CountAsync(x => x.Status == DiscountUsageStatus.Used, ct);
        var uniqueUsers = await baseQuery.Select(x => x.UserId).Distinct().CountAsync(ct);

        return new DiscountUsageSummaryDto(total, used, uniqueUsers);
    }

    public async Task<DiscountUsage?> GetByIdWithDetailsAsync(Guid id, CancellationToken ct)
        => await DbSet.Include(x => x.Campaign).ThenInclude(c => c!.Company)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<int> CountUserUsageAsync(Guid campaignId, Guid userId, CancellationToken ct)
        => await DbSet.CountAsync(x => x.CampaignId == campaignId && x.UserId == userId && x.Status == DiscountUsageStatus.Used, ct);

    public async Task<List<DiscountUsage>> GetUserUsagesAsync(Guid userId, CancellationToken ct)
        => await DbSet
            .Include(x => x.Campaign).ThenInclude(c => c!.Company)
            .Where(x => x.UserId == userId && x.Status == DiscountUsageStatus.Used)
            .OrderByDescending(x => x.UsedAt)
            .ToListAsync(ct);

    public async Task<Dictionary<Guid, int>> GetUserUsageCountsByCampaignsAsync(Guid userId, IEnumerable<Guid> campaignIds, CancellationToken ct)
    {
        var ids = campaignIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        var counts = await DbSet
            .Where(x => x.UserId == userId && ids.Contains(x.CampaignId) && x.Status == DiscountUsageStatus.Used)
            .GroupBy(x => x.CampaignId)
            .Select(g => new { CampaignId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var dict = counts.ToDictionary(x => x.CampaignId, x => x.Count);
        foreach (var id in ids)
            dict.TryAdd(id, 0);

        return dict;
    }

    public async Task<PagedResult<CompanyCampaignUsageDto>> GetCompanyUsagesAsync(Guid companyId, CompanyCampaignUsageListParams p, CancellationToken ct)
    {
        var query = DbSet.AsNoTracking()
            .Include(x => x.Campaign)
            .Where(x => x.CompanyId == companyId && x.Status == DiscountUsageStatus.Used);

        if (p.CampaignId.HasValue)
            query = query.Where(x => x.CampaignId == p.CampaignId.Value);

        if (!string.IsNullOrWhiteSpace(p.DateRange))
        {
            var today = TurkeyTime.TodayStartUtc();
            query = p.DateRange.Trim().ToLowerInvariant() switch
            {
                "today" => query.Where(x => x.UsedAt >= today),
                "week"  => query.Where(x => x.UsedAt >= today.AddDays(-7)),
                "month" => query.Where(x => x.UsedAt >= today.AddDays(-30)),
                _       => query,
            };
        }

        query = query.OrderByDescending(x => x.UsedAt);

        var page = Math.Max(1, p.PageResolved);
        var limit = Math.Clamp(p.LimitResolved, 1, 100);

        var total = await query.CountAsync(ct);
        var rows = await query
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(x => new { x.Id, x.CampaignId, CampaignName = x.Campaign != null ? x.Campaign.Name : "", x.UserName, x.UserPhone, x.UsedAt, x.Status })
            .ToListAsync(ct);

        var items = rows.Select(x => new CompanyCampaignUsageDto(
            x.Id, x.CampaignId, x.CampaignName, IdentityMask.MaskNameStrict(x.UserName),
            IdentityMask.MaskPhoneStrict(x.UserPhone), x.UsedAt, x.Status.ToString())).ToList();

        return new PagedResult<CompanyCampaignUsageDto> { Items = items, Total = total, Page = page, Limit = limit };
    }

    private static IQueryable<DiscountUsage> ApplyFilters(IQueryable<DiscountUsage> query, DiscountUsageListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.UserName, $"%{term}%") ||
                EF.Functions.ILike(x.DiscountCode, $"%{term}%") ||
                (x.UserPhone != null && x.UserPhone.Contains(term)));
        }

        if (p.CompanyId.HasValue)
            query = query.Where(x => x.CompanyId == p.CompanyId.Value);

        if (p.CampaignId.HasValue)
            query = query.Where(x => x.CampaignId == p.CampaignId.Value);

        if (!ignoreStatus && Enum.TryParse<DiscountUsageStatus>(p.Status, true, out var status))
            query = query.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(p.DateRange))
        {
            var now = DateTime.UtcNow;
            var today = now.Date;
            query = p.DateRange.Trim().ToLowerInvariant() switch
            {
                "today" => query.Where(x => x.UsedAt >= today),
                "week"  => query.Where(x => x.UsedAt >= today.AddDays(-7)),
                "month" => query.Where(x => x.UsedAt >= today.AddDays(-30)),
                _       => query,
            };
        }

        return query;
    }

    private static IQueryable<DiscountUsage> ApplySort(IQueryable<DiscountUsage> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "username"    => desc ? query.OrderByDescending(x => x.UserName)    : query.OrderBy(x => x.UserName),
            "orderamount" => desc ? query.OrderByDescending(x => x.OrderAmount) : query.OrderBy(x => x.OrderAmount),
            "usedat"      => desc ? query.OrderByDescending(x => x.UsedAt)      : query.OrderBy(x => x.UsedAt),
            "status"      => desc ? query.OrderByDescending(x => x.Status)      : query.OrderBy(x => x.Status),
            _             => query.OrderByDescending(x => x.UsedAt),
        };
    }
}
