using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Features.Loyalty.Dtos;
using Nexora.Application.Features.Loyalty.Requests;

namespace Nexora.Application.Features.Loyalty;

public interface ILoyaltyService
{
    Task<PagedResult<LoyaltyRuleDto>> GetRulesAsync(LoyaltyRuleListParams p, CancellationToken ct);
    Task<LoyaltyRuleDto> CreateRuleAsync(CreateLoyaltyRuleRequest req, CancellationToken ct);
    Task<LoyaltyRuleDto> UpdateRuleAsync(Guid id, UpdateLoyaltyRuleRequest req, CancellationToken ct);
    Task DeleteRuleAsync(Guid id, CancellationToken ct);

    Task<DailyCheckInResultDto> DailyCheckInAsync(Guid participantId, CancellationToken ct);
    Task AcknowledgeStreakModalAsync(Guid participantId, CancellationToken ct);
    Task<LoyaltyStreakDto> GetStreakAsync(Guid participantId, CancellationToken ct);
    Task<List<EarnWayDto>> GetEarnWaysAsync(Guid participantId, CancellationToken ct);
    Task<WelcomeBonusDto> ConsumeWelcomeBonusAsync(Guid participantId, CancellationToken ct);
    Task<PagedResult<LoyaltyTransactionDto>> GetTransactionsAsync(LoyaltyTransactionListParams p, CancellationToken ct);
    Task<int> GetBalanceAsync(Guid participantId, CancellationToken ct);
    Task<LoyaltyRuleDto?> GetRuleByActionKeyAsync(string actionKey, CancellationToken ct);
    Task AwardPointsAsync(AwardPointsRequest req, CancellationToken ct);
    Task<LoyaltyTransactionDto> AdminGrantPointsAsync(AdminGrantPointsRequest req, CancellationToken ct);

    Task<List<RewardDto>> GetRewardCatalogAsync(int limit, CancellationToken ct);
    Task<RedeemResultDto> RedeemRewardAsync(Guid participantId, Guid rewardId, CancellationToken ct);
    Task<PagedResult<RewardDto>> GetRewardsPagedAsync(RewardListParams p, CancellationToken ct);
    Task<RewardDto> CreateRewardAsync(CreateRewardRequest req, CancellationToken ct);
    Task<RewardDto> UpdateRewardAsync(Guid id, UpdateRewardRequest req, CancellationToken ct);
    Task DeleteRewardAsync(Guid id, CancellationToken ct);
    Task<RewardDto> ToggleRewardStatusAsync(Guid id, CancellationToken ct);
    Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct);
    Task<PagedResult<RewardRedemptionDto>> GetRedemptionsAsync(RedemptionListParams p, CancellationToken ct);
    Task CancelRedemptionAsync(Guid redemptionId, string? reason, CancellationToken ct);
    Task<int> GetPendingRedemptionCountAsync(CancellationToken ct);
    Task<RewardRedemptionDto> ClaimRedemptionAsync(Guid participantId, Guid redemptionId, CancellationToken ct);
}
