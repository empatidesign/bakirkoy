using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty.Dtos;
using Nexora.Domain.Entities.Loyalty;

namespace Nexora.Application.Common.Repositories;

public interface ILoyaltyRuleRepository : IRepository<LoyaltyRule>
{
    Task<LoyaltyRule?> GetByActionKeyAsync(string actionKey, CancellationToken ct);
    Task<PagedResult<LoyaltyRule>> GetPagedAsync(int page, int limit, string? search, bool? isActive, CancellationToken ct);
}

public interface ILoyaltyTransactionRepository : IRepository<LoyaltyTransaction>
{
    Task<PagedResult<LoyaltyTransaction>> GetPagedAsync(int page, int limit, Guid? participantId, string? actionKey, DateTime? from, DateTime? to, CancellationToken ct);
    Task<int> GetBalanceAsync(Guid participantId, CancellationToken ct);
    Task<bool> HasTransactionTodayAsync(Guid participantId, string actionKey, CancellationToken ct);
    Task<int> GetPointsSumSinceAsync(Guid participantId, string actionKey, DateTime sinceUtc, CancellationToken ct);
    Task<bool> ExistsAsync(Guid participantId, string actionKey, string referenceId, CancellationToken ct);
}

public interface IDailyStreakRepository : IRepository<DailyStreak>
{
    Task<DailyStreak?> GetByParticipantAsync(Guid participantId, CancellationToken ct);
}

public interface IRewardRepository : IRepository<Reward>
{
    Task<List<Reward>> GetCatalogAsync(int limit, CancellationToken ct);
    Task<PagedResult<Reward>> GetPagedAsync(RewardListParams p, CancellationToken ct);
}

public interface IRewardRedemptionRepository : IRepository<RewardRedemption>
{
    Task<List<RewardRedemption>> GetByParticipantAsync(Guid participantId, CancellationToken ct);
    Task<PagedResult<RewardRedemption>> GetPagedAsync(RedemptionListParams p, CancellationToken ct);
    Task<int> CountPendingAsync(CancellationToken ct);
}
