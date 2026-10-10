using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.ParticipantCampaigns.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CompanyRepository(AppDbContext context)
    : Repository<Company>(context), ICompanyRepository
{
    public async Task<PagedResult<Company>> GetPagedAsync(CompanyListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(DbSet.Include(x => x.ServiceCategory).AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<CompanySummaryDto> GetSummaryAsync(CompanyListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p, ignoreStatus: true);

        var total = await baseQuery.CountAsync(ct);
        var pending = await baseQuery.CountAsync(x => x.Status == CompanyStatus.Pending, ct);
        var approved = await baseQuery.CountAsync(x => x.Status == CompanyStatus.Approved, ct);
        var rejected = await baseQuery.CountAsync(x => x.Status == CompanyStatus.Rejected, ct);
        var passive = await baseQuery.CountAsync(x => x.Status == CompanyStatus.Passive, ct);

        return new CompanySummaryDto(total, pending, approved, rejected, passive);
    }

    public async Task<Company?> GetByIdWithCampaignsAsync(Guid id, CancellationToken ct)
        => await DbSet.Include(x => x.Campaigns).FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<Company?> GetByIdWithServiceCategoryAsync(Guid id, CancellationToken ct)
        => await DbSet.Include(x => x.ServiceCategory).FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task<Company?> GetByEmailAsync(string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await DbSet.FirstOrDefaultAsync(x => x.Email == normalized, ct);
    }

    public async Task<Company?> GetByPhoneAsync(string phone, CancellationToken ct)
    {
        var raw = phone.Trim();
        var normalized = Nexora.Application.Common.Security.LoginIdentifier.NormalizeTrPhone(raw);
        return await DbSet.FirstOrDefaultAsync(x => x.Phone == normalized || x.Phone == raw, ct);
    }

    public async Task<Company?> GetByTaxNumberAsync(string taxNumber, CancellationToken ct)
    {
        var normalized = taxNumber.Trim();
        return await DbSet.FirstOrDefaultAsync(x => x.TaxNumber == normalized, ct);
    }

    public async Task<bool> ExistsByEmailAsync(string email, Guid? excludeId, CancellationToken ct)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await DbSet.AnyAsync(x => x.Email == normalized && (excludeId == null || x.Id != excludeId), ct);
    }

    public async Task<bool> ExistsByPhoneAsync(string phone, Guid? excludeId, CancellationToken ct)
    {
        var normalized = phone.Trim();
        return await DbSet.AnyAsync(x => x.Phone == normalized && (excludeId == null || x.Id != excludeId), ct);
    }

    public async Task<bool> ExistsByTaxNumberAsync(string taxNumber, Guid? excludeId, CancellationToken ct)
    {
        var normalized = taxNumber.Trim();
        return await DbSet.AnyAsync(x => x.TaxNumber == normalized && (excludeId == null || x.Id != excludeId), ct);
    }

    public async Task<List<Company>> GetActiveOptionsAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == CompanyStatus.Approved).OrderBy(x => x.Name).ToListAsync(ct);

    public async Task<PagedResult<Company>> GetApprovedDirectoryPagedAsync(CitizenDirectoryCompanyListParams p, CancellationToken ct)
    {
        var query = DbSet.Include(x => x.ServiceCategory)
            .Where(x => x.Status == CompanyStatus.Approved)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{term}%") ||
                EF.Functions.ILike(x.Address, $"%{term}%") ||
                EF.Functions.ILike(x.District, $"%{term}%"));
        }

        if (p.CategoryIds is { Count: > 0 })
            query = query.Where(x => x.ServiceCategoryId.HasValue && p.CategoryIds.Contains(x.ServiceCategoryId.Value));

        if (!string.IsNullOrWhiteSpace(p.District))
            query = query.Where(x => x.District == p.District);

        if (p.OnlyWithLocation)
            query = query.Where(x => x.Latitude.HasValue && x.Longitude.HasValue);

        if (p.OnlyWithCampaigns)
            query = query.Where(x => x.Campaigns.Any(c => c.Status == CampaignStatus.Active));

        var wantsDistanceSort = string.Equals(p.Sort, "distance", StringComparison.OrdinalIgnoreCase)
            && p.Latitude.HasValue && p.Longitude.HasValue;

        if (wantsDistanceSort)
        {
            var all = await query.AsNoTracking().ToListAsync(ct);
            var ordered = all
                .OrderBy(x => x.Latitude.HasValue && x.Longitude.HasValue
                    ? GeoDistance.HaversineMeters(p.Latitude!.Value, p.Longitude!.Value, x.Latitude!.Value, x.Longitude!.Value)
                    : double.MaxValue)
                .ThenBy(x => x.Name)
                .ToList();

            var page = Math.Max(1, p.PageResolved);
            var limit = Math.Clamp(p.LimitResolved, 1, 100);
            var pageItems = ordered.Skip((page - 1) * limit).Take(limit).ToList();

            return new PagedResult<Company>
            {
                Items = pageItems,
                Total = ordered.Count,
                Page = page,
                Limit = limit,
            };
        }

        query = query.OrderBy(x => x.Name);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<List<string>> GetApprovedDistrictsAsync(CancellationToken ct)
        => await DbSet.Where(x => x.Status == CompanyStatus.Approved && x.District != "")
            .Select(x => x.District)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(ct);

    public async Task<int> CountCampaignTotalsAsync(Guid companyId, CancellationToken ct)
        => await Context.Campaigns.CountAsync(x => x.CompanyId == companyId, ct);

    public async Task<int> CountUsageTotalsAsync(Guid companyId, CancellationToken ct)
        => await Context.DiscountUsages.CountAsync(x => x.CompanyId == companyId, ct);

    public async Task<CompanyDashboardDto> GetDashboardAsync(CancellationToken ct)
    {
        var totalCompanies = await DbSet.CountAsync(ct);
        var pendingCompanies = await DbSet.CountAsync(x => x.Status == CompanyStatus.Pending, ct);
        var approvedCompanies = await DbSet.CountAsync(x => x.Status == CompanyStatus.Approved, ct);
        var rejectedCompanies = await DbSet.CountAsync(x => x.Status == CompanyStatus.Rejected, ct);
        var passiveCompanies = await DbSet.CountAsync(x => x.Status == CompanyStatus.Passive, ct);

        var activeCampaigns = await Context.Campaigns.CountAsync(x => x.Status == CampaignStatus.Active, ct);
        var totalUsages = await Context.DiscountUsages.CountAsync(x => x.Status == DiscountUsageStatus.Used, ct);

        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var previousMonthStart = monthStart.AddMonths(-1);

        var monthlyUsages = await Context.DiscountUsages
            .CountAsync(x => x.UsedAt >= monthStart, ct);
        var previousMonthlyUsages = await Context.DiscountUsages
            .CountAsync(x => x.UsedAt >= previousMonthStart && x.UsedAt < monthStart, ct);

        var topCampaignGroups = await Context.Campaigns
            .GroupBy(x => x.CompanyId)
            .Select(g => new { CompanyId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(5)
            .ToListAsync(ct);

        var topCampaignIds = topCampaignGroups.Select(x => x.CompanyId).ToList();
        var topCampaignCompanies = await DbSet
            .Where(c => topCampaignIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);
        var topByCampaigns = topCampaignGroups
            .Where(g => topCampaignCompanies.ContainsKey(g.CompanyId))
            .Select(g => new CompanyTopItemDto(topCampaignCompanies[g.CompanyId].Id, topCampaignCompanies[g.CompanyId].Name, g.Count))
            .ToList();

        var topUsageGroups = await Context.DiscountUsages
            .GroupBy(x => x.CompanyId)
            .Select(g => new { CompanyId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(5)
            .ToListAsync(ct);

        var topUsageIds = topUsageGroups.Select(x => x.CompanyId).ToList();
        var topUsageCompanies = await DbSet
            .Where(c => topUsageIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);
        var topByUsages = topUsageGroups
            .Where(g => topUsageCompanies.ContainsKey(g.CompanyId))
            .Select(g => new CompanyTopItemDto(topUsageCompanies[g.CompanyId].Id, topUsageCompanies[g.CompanyId].Name, g.Count))
            .ToList();

        return new CompanyDashboardDto(
            totalCompanies,
            pendingCompanies,
            approvedCompanies,
            activeCampaigns,
            totalUsages,
            monthlyUsages,
            previousMonthlyUsages,
            new CompanyStatusDistributionDto(approvedCompanies, pendingCompanies, rejectedCompanies, passiveCompanies),
            topByCampaigns,
            topByUsages);
    }

    private static IQueryable<Company> ApplyFilters(IQueryable<Company> query, CompanyListParams p, bool ignoreStatus = false)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{term}%") ||
                (x.Email != null && EF.Functions.ILike(x.Email, $"%{term}%")) ||
                x.Phone.Contains(term) ||
                x.TaxNumber.Contains(term));
        }

        if (!ignoreStatus && Enum.TryParse<CompanyStatus>(p.Status, true, out var status))
            query = query.Where(x => x.Status == status);

        if (p.ServiceCategoryId.HasValue)
            query = query.Where(x => x.ServiceCategoryId == p.ServiceCategoryId.Value);

        return query;
    }

    private static IQueryable<Company> ApplySort(IQueryable<Company> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "name"      => desc ? query.OrderByDescending(x => x.Name)      : query.OrderBy(x => x.Name),
            "email"     => desc ? query.OrderByDescending(x => x.Email)     : query.OrderBy(x => x.Email),
            "status"    => desc ? query.OrderByDescending(x => x.Status)    : query.OrderBy(x => x.Status),
            "district"  => desc ? query.OrderByDescending(x => x.District)  : query.OrderBy(x => x.District),
            "category"  => desc ? query.OrderByDescending(x => x.ServiceCategory != null ? x.ServiceCategory.Name : "") : query.OrderBy(x => x.ServiceCategory != null ? x.ServiceCategory.Name : ""),
            "createdat" => desc ? query.OrderByDescending(x => x.CreatedAt) : query.OrderBy(x => x.CreatedAt),
            _           => query.OrderByDescending(x => x.CreatedAt),
        };
    }
}
