namespace Nexora.Application.Features.Loyalty.Requests;

public record CreateLoyaltyRuleRequest(string ActionKey, string Label, int Points, string? Description);
public record UpdateLoyaltyRuleRequest(string Label, int Points, bool IsActive, string? Description);
public record AwardPointsRequest(Guid ParticipantId, string ActionKey, string? ReferenceId, int? PointsOverride = null);
public record AdminGrantPointsRequest(Guid ParticipantId, int Points, string Description);
public record CreateRewardRequest(string Name, int PointsRequired, int Stock, string? Description, string? ImageUrl);
public record UpdateRewardRequest(string Name, int PointsRequired, int Stock, bool IsActive, string? Description, string? ImageUrl);
public record RedeemRewardRequest(Guid RewardId);
