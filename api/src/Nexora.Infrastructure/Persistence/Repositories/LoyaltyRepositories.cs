using Microsoft.EntityFrameworkCore;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty.Dtos;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Common;

namespace Nexora.Infrastructure.Persistence.Repositories;

public class LoyaltyRuleRepository(AppDbContext context)
    : Repository<LoyaltyRule>(context), ILoyaltyRuleRepository
{
    public Task<LoyaltyRule?> GetByActionKeyAsync(string actionKey, CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(r => r.ActionKey == actionKey, ct);

    public async Task<PagedResult<LoyaltyRule>> GetPagedAsync(int page, int limit, string? search, bool? isActive, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(r => r.Label.Contains(search) || r.ActionKey.Contains(search));
        if (isActive.HasValue)
            query = query.Where(r => r.IsActive == isActive.Value);
        query = query.OrderBy(r => r.ActionKey);
        return await PaginateAsync(query, page, limit, ct);
    }
}

public class LoyaltyTransactionRepository(AppDbContext context)
    : Repository<LoyaltyTransaction>(context), ILoyaltyTransactionRepository
{
    public async Task<PagedResult<LoyaltyTransaction>> GetPagedAsync(int page, int limit, Guid? participantId, string? actionKey, DateTime? from, DateTime? to, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();
        if (participantId.HasValue) query = query.Where(t => t.ParticipantId == participantId.Value);
        if (!string.IsNullOrWhiteSpace(actionKey)) query = query.Where(t => t.ActionKey == actionKey);
        if (from.HasValue) query = query.Where(t => t.EarnedAt >= from.Value);
        if (to.HasValue) query = query.Where(t => t.EarnedAt <= to.Value);
        query = query.OrderByDescending(t => t.EarnedAt);
        return await PaginateAsync(query, page, limit, ct);
    }

    public Task<int> GetBalanceAsync(Guid participantId, CancellationToken ct)
        => DbSet.Where(t => t.ParticipantId == participantId).SumAsync(t => t.Points, ct);

    public Task<bool> HasTransactionTodayAsync(Guid participantId, string actionKey, CancellationToken ct)
    {
        var startUtc = TurkeyTime.TodayStartUtc();
        return DbSet.AnyAsync(t =>
            t.ParticipantId == participantId &&
            t.ActionKey == actionKey &&
            t.EarnedAt >= startUtc, ct);
    }

    public Task<int> GetPointsSumSinceAsync(Guid participantId, string actionKey, DateTime sinceUtc, CancellationToken ct)
        => DbSet.Where(t =>
            t.ParticipantId == participantId &&
            t.ActionKey == actionKey &&
            t.EarnedAt >= sinceUtc &&
            t.Points > 0)
            .SumAsync(t => t.Points, ct);

    public Task<bool> ExistsAsync(Guid participantId, string actionKey, string referenceId, CancellationToken ct)
        => DbSet.AnyAsync(t =>
            t.ParticipantId == participantId &&
            t.ActionKey == actionKey &&
            t.ReferenceId == referenceId, ct);
}

public class DailyStreakRepository(AppDbContext context)
    : Repository<DailyStreak>(context), IDailyStreakRepository
{
    public Task<DailyStreak?> GetByParticipantAsync(Guid participantId, CancellationToken ct)
        => DbSet.FirstOrDefaultAsync(s => s.ParticipantId == participantId, ct);
}

public class RewardRepository(AppDbContext context)
    : Repository<Reward>(context), IRewardRepository
{
    public Task<List<Reward>> GetCatalogAsync(int limit, CancellationToken ct)
        => DbSet.Where(r => r.IsActive && r.Stock > 0)
                .OrderBy(r => r.PointsRequired)
                .Take(limit)
                .ToListAsync(ct);

    public async Task<PagedResult<Reward>> GetPagedAsync(RewardListParams p, CancellationToken ct)
    {
        var query = DbSet.AsQueryable();

        if (!string.IsNullOrWhiteSpace(p.Search))
            query = query.Where(r => r.Name.Contains(p.Search) || (r.Description != null && r.Description.Contains(p.Search)));

        if (p.IsActiveResolved.HasValue)
            query = query.Where(r => r.IsActive == p.IsActiveResolved.Value);

        query = (p.Sort?.ToLowerInvariant(), string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase)) switch
        {
            ("name", true)           => query.OrderByDescending(r => r.Name),
            ("name", false)          => query.OrderBy(r => r.Name),
            ("pointsrequired", true) => query.OrderByDescending(r => r.PointsRequired),
            ("pointsrequired", false)=> query.OrderBy(r => r.PointsRequired),
            ("stock", true)          => query.OrderByDescending(r => r.Stock),
            ("stock", false)         => query.OrderBy(r => r.Stock),
            _                         => query.OrderBy(r => r.PointsRequired).ThenBy(r => r.Name),
        };

        return await PaginateAsync(query, p.PageResolved, p.LimitResolved, ct);
    }
}

public class RewardRedemptionRepository(AppDbContext context)
    : Repository<RewardRedemption>(context), IRewardRedemptionRepository
{
    public Task<List<RewardRedemption>> GetByParticipantAsync(Guid participantId, CancellationToken ct)
        => DbSet.Where(r => r.ParticipantId == participantId)
                .OrderByDescending(r => r.RedeemedAt)
                .ToListAsync(ct);

    public async Task<PagedResult<RewardRedemption>> GetPagedAsync(RedemptionListParams p, CancellationToken ct)
    {
        var q = DbSet.AsQueryable();

        if (Guid.TryParse(p.ParticipantId, out var participantId))
            q = q.Where(r => r.ParticipantId == participantId);

        if (!string.IsNullOrWhiteSpace(p.Search))
            q = q.Where(r => r.RewardName.Contains(p.Search));

        if (!string.IsNullOrWhiteSpace(p.Status))
            q = q.Where(r => r.Status == p.Status);

        q = (p.Sort?.ToLowerInvariant(), string.Equals(p.Order, "desc", StringComparison.OrdinalIgnoreCase)) switch
        {
            ("rewardname", true)   => q.OrderByDescending(r => r.RewardName),
            ("rewardname", false)  => q.OrderBy(r => r.RewardName),
            ("pointsspent", true)  => q.OrderByDescending(r => r.PointsSpent),
            ("pointsspent", false) => q.OrderBy(r => r.PointsSpent),
            ("redeemedat", true)   => q.OrderByDescending(r => r.RedeemedAt),
            ("redeemedat", false)  => q.OrderBy(r => r.RedeemedAt),
            _ => q.OrderByDescending(r => r.RedeemedAt),
        };

        return await PaginateAsync(q, p.PageResolved, p.LimitResolved, ct);
    }

    public Task<int> CountPendingAsync(CancellationToken ct)
        => DbSet.CountAsync(r => !r.IsDeleted && r.Status == "Pending", ct);
}
