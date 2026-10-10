namespace Nexora.Application.Features.Loyalty.Dtos;

public record LoyaltyRuleDto(
    string Id, string ActionKey, string Label, int Points, bool IsActive, string? Description);

public record LoyaltyTransactionDto(
    string Id,
    string ActionKey,
    string Label,
    int Points,
    int BalanceAfter,
    string? ReferenceId,
    DateTime EarnedAt,
    string Type,
    string Description,
    string ParticipantId,
    string? ParticipantName,
    string? ParticipantPhone);

public record LoyaltyStreakDto(
    int CurrentStreak,
    int LongestStreak,
    int TotalPoints,
    string? LastCheckInDate,
    List<StreakDayDto> WeekDays,
    int Target,
    int DailyPoints,
    int BonusPoints,
    // Bu turda tamamlanan gün sayısı (0..Target). Seri 7'yi geçince sayaç
    // başa döner; ödül her 7 günde bir verildiği için ilerleme bu tur
    // üzerinden gösterilir.
    int CycleProgress,
    // Ödüle kalan gün. Bugün henüz giriş yapılmadıysa bugünü de kapsar.
    int DaysToReward,
    // Bugün giriş yapıldı mı — modal "bugünü tamamladın" durumunu ayırır.
    bool CheckedInToday,
    // Önceki seri kaçırılan bir gün yüzünden sıfırlandıysa true; arayüz
    // suçlayıcı olmayan bir "seri yeniden başladı" bilgisi gösterir.
    bool StreakBroken);

public record StreakDayDto(int DayNumber, bool IsCompleted, bool IsToday, bool IsFuture);

public record DailyCheckInResultDto(
    bool IsNewCheckIn,
    int PointsEarned,
    bool ShouldShowStreakModal,
    LoyaltyStreakDto Streak);

public record EarnWayDto(string Key, string Label, int Points, string Icon, bool Completed, string? Description);

public record WelcomeBonusDto(bool ShouldShow, int Points);

public record RewardDto(string Id, string Name, int PointsRequired, string? ImageUrl, int Stock, string? Description, bool IsActive);

public record RedeemResultDto(bool Success, string Message, int BalanceAfter);

public record LoyaltyRuleListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public bool? IsActive { get; init; }
}

public record LoyaltyTransactionListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? ParticipantId { get; init; }
    public string? ActionKey { get; init; }
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
}

public record RewardRedemptionDto(
    Guid Id,
    Guid ParticipantId,
    string ParticipantName,
    Guid RewardId,
    string RewardName,
    string? RewardImageUrl,
    int PointsSpent,
    string Status,
    DateTime RedeemedAt,
    DateTime? CancelledAt,
    string? CancelReason
);

public record RedemptionListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? Status { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }
    public string? ParticipantId { get; init; }
}

public record CancelRedemptionRequest(string? Reason);

public record RewardListParams
{
    public string? Page { get; init; }
    public string? Limit { get; init; }
    public int PageResolved  => int.TryParse(Page,  out var v) && v > 0 ? v : 1;
    public int LimitResolved => int.TryParse(Limit, out var v) && v > 0 ? v : 25;
    public string? Search { get; init; }
    public string? IsActive { get; init; }
    public string? Sort { get; init; }
    public string? Order { get; init; }

    public bool? IsActiveResolved => bool.TryParse(IsActive, out var v) ? v : null;
}
