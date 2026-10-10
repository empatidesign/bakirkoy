using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class CampaignRedemptionRepository(AppDbContext context)
    : Repository<CampaignRedemption>(context), ICampaignRedemptionRepository
{
    public async Task<List<CampaignRedemption>> GetByCompanyIdAsync(Guid companyId, CancellationToken ct)
        => await DbSet
            .Include(r => r.Participant)
            .Include(r => r.Campaign)
            .Where(r => r.CompanyId == companyId)
            .OrderByDescending(r => r.RedeemedAt)
            .ToListAsync(ct);

    public async Task<List<CampaignRedemption>> GetByParticipantIdAsync(Guid participantId, CancellationToken ct)
        => await DbSet
            .Include(r => r.Company)
            .Include(r => r.Campaign)
            .Where(r => r.ParticipantId == participantId)
            .OrderByDescending(r => r.RedeemedAt)
            .ToListAsync(ct);

    public async Task<int> CountByParticipantAndCampaignAsync(Guid participantId, Guid campaignId, CancellationToken ct)
        => await DbSet
            .CountAsync(r => r.ParticipantId == participantId && r.CampaignId == campaignId, ct);

    public async Task<Dictionary<Guid, int>> GetParticipantCountsByCampaignsAsync(Guid participantId, IEnumerable<Guid> campaignIds, CancellationToken ct)
    {
        var ids = campaignIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        var counts = await DbSet
            .Where(r => r.ParticipantId == participantId && r.CampaignId != null && ids.Contains(r.CampaignId!.Value))
            .GroupBy(r => r.CampaignId!.Value)
            .Select(g => new { CampaignId = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var dict = counts.ToDictionary(x => x.CampaignId, x => x.Count);
        foreach (var id in ids)
            dict.TryAdd(id, 0);

        return dict;
    }

    // DiscountUsageRepository.GetPagedAsync/GetSummaryAsync ile aynı desende — admin panelin
    // CampaignRedemption kayıtlarını da DiscountUsage gibi listeleyip raporlayabilmesi için
    // (bkz. loyalty-ecosystem-audit-2026-08-04 P0 bulgusu).
    public async Task<PagedResult<CampaignRedemption>> GetPagedAsync(CampaignRedemptionListParams p, CancellationToken ct)
    {
        var query = ApplyFilters(
            DbSet.Include(x => x.Company).Include(x => x.Campaign).Include(x => x.Participant).AsQueryable(), p);
        query = ApplySort(query, p.Sort, p.Order);
        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    public async Task<CampaignRedemptionSummaryDto> GetSummaryAsync(CampaignRedemptionListParams p, CancellationToken ct)
    {
        var baseQuery = ApplyFilters(DbSet.AsQueryable(), p);

        var total = await baseQuery.CountAsync(ct);
        var uniqueParticipants = await baseQuery.Select(x => x.ParticipantId).Distinct().CountAsync(ct);
        var qrScanCount = await baseQuery.CountAsync(x => x.RedemptionType == RedemptionType.QrScan, ct);
        var directScanCount = await baseQuery.CountAsync(x => x.RedemptionType == RedemptionType.DirectScan, ct);

        return new CampaignRedemptionSummaryDto(total, uniqueParticipants, qrScanCount, directScanCount);
    }

    public async Task<CampaignRedemption?> GetByIdWithDetailsAsync(Guid id, CancellationToken ct)
        => await DbSet
            .Include(x => x.Company)
            .Include(x => x.Campaign)
            .Include(x => x.Participant)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

    private static IQueryable<CampaignRedemption> ApplyFilters(IQueryable<CampaignRedemption> query, CampaignRedemptionListParams p)
    {
        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = LikeQuery.Escape(p.Search.Trim());
            query = query.Where(x =>
                EF.Functions.ILike(x.Participant.FullName, $"%{term}%") ||
                EF.Functions.ILike(x.RedemptionCode, $"%{term}%") ||
                (x.Participant.Phone != null && x.Participant.Phone.Contains(term)));
        }

        if (p.CompanyId.HasValue)
            query = query.Where(x => x.CompanyId == p.CompanyId.Value);

        if (p.CampaignId.HasValue)
            query = query.Where(x => x.CampaignId == p.CampaignId.Value);

        if (Enum.TryParse<RedemptionType>(p.RedemptionType, true, out var type))
            query = query.Where(x => x.RedemptionType == type);

        if (!string.IsNullOrWhiteSpace(p.DateRange))
        {
            var today = TurkeyTime.TodayStartUtc();
            query = p.DateRange.Trim().ToLowerInvariant() switch
            {
                "today" => query.Where(x => x.RedeemedAt >= today),
                "week"  => query.Where(x => x.RedeemedAt >= today.AddDays(-7)),
                "month" => query.Where(x => x.RedeemedAt >= today.AddDays(-30)),
                _       => query,
            };
        }

        return query;
    }

    private static IQueryable<CampaignRedemption> ApplySort(IQueryable<CampaignRedemption> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "redeemedat" => desc ? query.OrderByDescending(x => x.RedeemedAt) : query.OrderBy(x => x.RedeemedAt),
            _            => query.OrderByDescending(x => x.RedeemedAt),
        };
    }
}
