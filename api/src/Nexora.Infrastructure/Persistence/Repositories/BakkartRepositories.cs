using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Bakkart.Dtos;
using Nexora.Domain.Entities.Bakkart;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class BakkartApplicationRepository(AppDbContext context)
    : Repository<BakkartApplication>(context), IBakkartApplicationRepository
{
    public async Task<PagedResult<BakkartApplication>> GetPagedAsync(BakkartApplicationListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
        {
            var term = p.Search.Trim();
            query = query.Where(a =>
                EF.Functions.ILike(a.TrackingNo, $"%{term}%") ||
                EF.Functions.ILike(a.TcknLast4, $"%{term}%") ||
                EF.Functions.ILike(a.PhoneLast4, $"%{term}%") ||
                EF.Functions.ILike(a.District, $"%{term}%"));
        }

        if (!string.IsNullOrWhiteSpace(p.Status) && Enum.TryParse<BakkartApplicationStatus>(p.Status, true, out var status))
            query = query.Where(a => a.Status == status);

        if (!string.IsNullOrWhiteSpace(p.CardType) && Enum.TryParse<BakkartCardType>(p.CardType, true, out var cardType))
            query = query.Where(a => a.CardType == cardType);

        query = ApplySort(query, p.Sort, p.Order);

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }

    private static IQueryable<BakkartApplication> ApplySort(IQueryable<BakkartApplication> query, string? sort, string? order)
    {
        var desc = string.Equals(order, "desc", StringComparison.OrdinalIgnoreCase);
        return sort?.ToLowerInvariant() switch
        {
            "trackingno" => desc ? query.OrderByDescending(a => a.TrackingNo) : query.OrderBy(a => a.TrackingNo),
            "status" => desc ? query.OrderByDescending(a => a.Status) : query.OrderBy(a => a.Status),
            "district" => desc ? query.OrderByDescending(a => a.District) : query.OrderBy(a => a.District),
            "appliedat" => desc ? query.OrderByDescending(a => a.AppliedAt) : query.OrderBy(a => a.AppliedAt),
            _ => query.OrderByDescending(a => a.AppliedAt),
        };
    }

    public async Task<BakkartApplicationSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var agg = await DbSet
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Pending = g.Count(a => a.Status == BakkartApplicationStatus.Pending),
                Approved = g.Count(a => a.Status == BakkartApplicationStatus.Approved),
                Rejected = g.Count(a => a.Status == BakkartApplicationStatus.Rejected),
            })
            .FirstOrDefaultAsync(ct);

        var activeCards = await Context.BakkartCards.CountAsync(c => c.Status == BakkartCardStatus.Active, ct);

        return new BakkartApplicationSummaryDto(
            agg?.Total ?? 0,
            agg?.Pending ?? 0,
            agg?.Approved ?? 0,
            agg?.Rejected ?? 0,
            activeCards,
            0);
    }

    public async Task<int> NextTrackingNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('bakkart_application_tracking_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<bool> ExistsActiveByTcknHashAsync(string tcknHash, CancellationToken ct)
        => await DbSet.AnyAsync(a => a.TcknHash == tcknHash
            && (a.Status == BakkartApplicationStatus.Pending || a.Status == BakkartApplicationStatus.Approved), ct);

    public async Task<BakkartApplication?> GetByTcknHashAsync(string tcknHash, CancellationToken ct)
        => await DbSet
            .Where(a => a.TcknHash == tcknHash)
            .OrderByDescending(a => a.AppliedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<List<BakkartApplication>> GetByParticipantIdAsync(Guid participantId, CancellationToken ct)
        => await DbSet
            .Where(a => a.ParticipantId == participantId)
            .OrderByDescending(a => a.AppliedAt)
            .ToListAsync(ct);
}

public class BakkartCardRepository(AppDbContext context)
    : Repository<BakkartCard>(context), IBakkartCardRepository
{
    public async Task<int> NextCardNumberAsync(CancellationToken ct)
        => (int)await Context.Database
            .SqlQueryRaw<long>("SELECT nextval('bakkart_card_no_seq') AS \"Value\"")
            .FirstAsync(ct);

    public async Task<BakkartCard?> GetByApplicationIdAsync(Guid applicationId, CancellationToken ct)
        => await DbSet.Include(c => c.Transactions).FirstOrDefaultAsync(c => c.ApplicationId == applicationId, ct);

    public async Task<List<BakkartCard>> GetByApplicationIdsAsync(IEnumerable<Guid> applicationIds, CancellationToken ct)
        => await DbSet.Where(c => applicationIds.Contains(c.ApplicationId)).ToListAsync(ct);

    public async Task<BakkartCard?> GetByParticipantIdAsync(Guid participantId, CancellationToken ct)
        => await DbSet
            .Where(c => c.ParticipantId == participantId)
            .OrderByDescending(c => c.IssuedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<BakkartCard?> GetByCardNoAsync(string cardNo, CancellationToken ct)
        => await DbSet.FirstOrDefaultAsync(c => c.CardNo == cardNo, ct);

    public async Task<int> CountActiveAsync(CancellationToken ct)
        => await DbSet.CountAsync(c => c.Status == BakkartCardStatus.Active, ct);
}

public class BakkartTransactionRepository(AppDbContext context)
    : Repository<BakkartTransaction>(context), IBakkartTransactionRepository
{
    public async Task<List<BakkartTransaction>> GetByCardIdAsync(Guid cardId, int limit, CancellationToken ct)
        => await DbSet
            .Where(t => t.CardId == cardId)
            .OrderByDescending(t => t.OccurredAt)
            .Take(limit)
            .ToListAsync(ct);

    public async Task<BakkartCardStatsDto> GetStatsAsync(Guid cardId, CancellationToken ct)
    {
        var card = await Context.BakkartCards.FirstOrDefaultAsync(c => c.Id == cardId, ct);

        var agg = await DbSet
            .Where(t => t.CardId == cardId)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalLoaded = g.Where(t => t.Type == BakkartTransactionType.BalanceLoad).Sum(t => t.AmountDelta),
                TotalSpent = g.Where(t => t.Type == BakkartTransactionType.BalanceSpend).Sum(t => -t.AmountDelta),
                TotalPointsEarned = g.Where(t => t.Type == BakkartTransactionType.PointsEarn).Sum(t => t.PointsDelta),
                TotalPointsSpent = g.Where(t => t.Type == BakkartTransactionType.PointsSpend).Sum(t => -t.PointsDelta),
                Count = g.Count(),
                LastAt = g.Max(t => (DateTime?)t.OccurredAt),
            })
            .FirstOrDefaultAsync(ct);

        return new BakkartCardStatsDto(
            card?.Balance ?? 0,
            card?.Points ?? 0,
            agg?.TotalLoaded ?? 0,
            agg?.TotalSpent ?? 0,
            agg?.TotalPointsEarned ?? 0,
            agg?.TotalPointsSpent ?? 0,
            agg?.Count ?? 0,
            agg?.LastAt);
    }
}
