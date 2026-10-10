using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Dtos;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Domain.Enums;
using Nexora.Domain.Common;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class LoyaltyService(IUnitOfWork uow, IServiceProvider serviceProvider, IRedisService redis, IAuditService audit, ICurrentUser currentUser, IOptionsMonitor<MinioSettings> minioOptions) : ILoyaltyService
{
    private static DateOnly TodayLocal() => TurkeyTime.Today();

    // Ödül periyodu domain'den gelir; gösterim ile bonus koşulu ayrışamaz.
    private const int StreakTarget = DailyStreak.BonusPeriodDays;

    private static readonly Dictionary<string, (string Icon, string DisplayLabel)> ActionMeta = new()
    {
        ["daily_login"]           = ("🗓️", "Günlük Giriş"),
        ["daily_login_streak_7"]  = ("🔥", "7 Günlük Seri Bonusu"),
        ["event_attendance"]      = ("🎉", "Etkinlik Katılımı"),
        ["quiz_complete"]         = ("🧠", "Quiz Tamamlama"),
        ["survey_complete"]       = ("📋", "Anket Doldurma"),
        ["travel_join"]           = ("🚌", "Gezi Katılımı"),
        ["event_review"]          = ("⭐", "Etkinlik Değerlendirmesi"),
        ["travel_review"]         = ("⭐", "Gezi Değerlendirmesi"),
    };

    public async Task<PagedResult<LoyaltyRuleDto>> GetRulesAsync(LoyaltyRuleListParams p, CancellationToken ct)
    {
        var result = await uow.LoyaltyRules.GetPagedAsync(p.PageResolved, p.LimitResolved, p.Search, p.IsActive, ct);
        return new PagedResult<LoyaltyRuleDto>
        {
            Items = result.Items.Select(ToRuleDto).ToList(),
            Total = result.Total, Page = result.Page, Limit = result.Limit,
        };
    }

    public async Task<LoyaltyRuleDto> CreateRuleAsync(CreateLoyaltyRuleRequest req, CancellationToken ct)
    {
        if (await uow.LoyaltyRules.GetByActionKeyAsync(req.ActionKey, ct) is not null)
            throw new ConflictException("Bu eylem anahtarı zaten tanımlı.", "RULE_KEY_EXISTS");
        var rule = LoyaltyRule.Create(req.ActionKey, req.Label, req.Points, req.Description);
        await uow.LoyaltyRules.AddAsync(rule, ct);
        await uow.SaveChangesAsync(ct);
        return ToRuleDto(rule);
    }

    public async Task<LoyaltyRuleDto> UpdateRuleAsync(Guid id, UpdateLoyaltyRuleRequest req, CancellationToken ct)
    {
        var rule = await uow.LoyaltyRules.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kural bulunamadı.", "RULE_NOT_FOUND");
        rule.Update(req.Label, req.Points, req.IsActive, req.Description);
        uow.LoyaltyRules.Update(rule);
        await uow.SaveChangesAsync(ct);
        return ToRuleDto(rule);
    }

    public async Task DeleteRuleAsync(Guid id, CancellationToken ct)
    {
        var rule = await uow.LoyaltyRules.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Kural bulunamadı.", "RULE_NOT_FOUND");
        uow.LoyaltyRules.Delete(rule);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<DailyCheckInResultDto> DailyCheckInAsync(Guid participantId, CancellationToken ct)
    {
        var checkInLock = $"loyalty:daily-checkin-lock:{participantId}";
        var checkInLockToken = await redis.TryAcquireLockAsync(checkInLock, TimeSpan.FromSeconds(10), ct);
        if (checkInLockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        try
        {
            var streak = await uow.DailyStreaks.GetByParticipantAsync(participantId, ct);
            bool isNewStreak = streak is null;
            streak ??= DailyStreak.Create(participantId);
            if (isNewStreak)
                await uow.DailyStreaks.AddAsync(streak, ct);

            var dailyRule = await uow.LoyaltyRules.GetByActionKeyAsync("daily_login", ct);
            var streakRule = await uow.LoyaltyRules.GetByActionKeyAsync("daily_login_streak_7", ct);
            int dailyPoints = dailyRule?.IsActive == true ? dailyRule.Points : 10;
            int streakBonus = streakRule?.IsActive == true ? streakRule.Points : 50;

            var (isNew, dailyEarned, streakBonusEarned) = streak.CheckIn(TodayLocal(), dailyPoints, streakBonus);
            var earned = dailyEarned + streakBonusEarned;

            if (isNew && dailyEarned > 0)
            {
                var balance = await uow.LoyaltyTransactions.GetBalanceAsync(participantId, ct);
                var tx = LoyaltyTransaction.Create(participantId, "daily_login",
                    $"Günlük giriş — {streak.CurrentStreak}. gün", dailyEarned, balance + dailyEarned);
                await uow.LoyaltyTransactions.AddAsync(tx, ct);
            }

            if (isNew && streakBonusEarned > 0)
            {
                var balanceAfterDaily = await uow.LoyaltyTransactions.GetBalanceAsync(participantId, ct);
                var bonusTx = LoyaltyTransaction.Create(participantId, "daily_login_streak_7",
                    $"7 günlük seri bonusu — {streak.CurrentStreak}. gün", streakBonusEarned, balanceAfterDaily + streakBonusEarned);
                await uow.LoyaltyTransactions.AddAsync(bonusTx, ct);
            }

            if (!isNewStreak)
                uow.DailyStreaks.Update(streak);
            await uow.SaveChangesAsync(ct);

            return new DailyCheckInResultDto(
                isNew,
                earned,
                streak.ShouldShowModal,
                await BuildStreakDtoAsync(streak, ct));
        }
        finally
        {
            await redis.ReleaseLockAsync(checkInLock, checkInLockToken, ct);
        }
    }

    public async Task AcknowledgeStreakModalAsync(Guid participantId, CancellationToken ct)
    {
        var streak = await uow.DailyStreaks.GetByParticipantAsync(participantId, ct);
        if (streak is null || !streak.AcknowledgeModal()) return;

        uow.DailyStreaks.Update(streak);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<LoyaltyStreakDto> GetStreakAsync(Guid participantId, CancellationToken ct)
    {
        var streak = await uow.DailyStreaks.GetByParticipantAsync(participantId, ct);
        if (streak is null) return await BuildEmptyStreakAsync(ct);
        return await BuildStreakDtoAsync(streak, ct);
    }

    public async Task<List<EarnWayDto>> GetEarnWaysAsync(Guid participantId, CancellationToken ct)
    {
        // #31 fix: eskiden IsActive=true olan TÜM LoyaltyRule kayıtları vatandaşa "puan kazanma
        // yolu" olarak gösteriliyordu — canlı DB'de bu kuralların çoğu (141'den ~130'u) e2e test
        // otomasyonunun bıraktığı "e2e_action_*"/"rich_event_join_*" kalıntılarıydı ve IsActive
        // bayrağı hâlâ true kalmıştı. Artık yalnızca uygulamanın gerçekten tanıdığı (ActionMeta
        // sözlüğündeki) sistem eylemleri gösteriliyor — DB'ye ileride eklenen rastgele/test
        // kuralları otomatik olarak vatandaşa sızmaz.
        var rules = (await uow.LoyaltyRules.FindAsync(r => r.IsActive, ct))
            .Where(r => ActionMeta.ContainsKey(r.ActionKey))
            .ToList();
        var today = TodayLocal();

        var streak = await uow.DailyStreaks.GetByParticipantAsync(participantId, ct);
        bool checkedInToday = streak?.LastCheckInDate == today;

        var result = new List<EarnWayDto>();
        foreach (var rule in rules.OrderBy(r => r.ActionKey))
        {
            bool completed = rule.ActionKey switch
            {
                "daily_login" => checkedInToday,
                "daily_login_streak_7" => streak != null &&
                    streak.WeekStartDate == DailyStreak.WeekStartOf(TodayLocal()) &&
                    streak.WeekCheckInCount == StreakTarget,
                _ => await uow.LoyaltyTransactions.HasTransactionTodayAsync(participantId, rule.ActionKey, ct),
            };

            var (icon, displayLabel) = ActionMeta.TryGetValue(rule.ActionKey, out var m) ? m : ("⭐", rule.Label);
            var description = string.IsNullOrWhiteSpace(rule.Description) ? displayLabel : rule.Description;
            result.Add(new EarnWayDto(rule.ActionKey, rule.Label, rule.Points, icon, completed, description));
        }
        return result;
    }

    public async Task<WelcomeBonusDto> ConsumeWelcomeBonusAsync(Guid participantId, CancellationToken ct)
    {
        var participant = await uow.Participants.GetByIdAsync(participantId, ct)
            ?? throw new NotFoundException("Kullanıcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        if (participant.WelcomeBonusSeenAt.HasValue)
            return new WelcomeBonusDto(false, 0);

        var tx = (await uow.LoyaltyTransactions
                .FindAsync(t => t.ParticipantId == participantId && t.ActionKey == "welcome_bonus", ct))
            .FirstOrDefault();

        if (tx is null)
            return new WelcomeBonusDto(false, 0);

        participant.MarkWelcomeBonusSeen();
        uow.Participants.Update(participant);
        await uow.SaveChangesAsync(ct);

        return new WelcomeBonusDto(true, tx.Points);
    }

    public async Task<PagedResult<LoyaltyTransactionDto>> GetTransactionsAsync(LoyaltyTransactionListParams p, CancellationToken ct)
    {
        Guid? pid = p.ParticipantId is not null && Guid.TryParse(p.ParticipantId, out var g) ? g : null;
        var result = await uow.LoyaltyTransactions.GetPagedAsync(p.PageResolved, p.LimitResolved, pid, p.ActionKey, p.From, p.To, ct);

        var participantIds = result.Items.Select(t => t.ParticipantId).Distinct().ToList();
        var participants = await uow.Participants.FindAsync(x => participantIds.Contains(x.Id), ct);
        var pMap = participants.ToDictionary(x => x.Id, x => (x.FullName, x.Phone));

        return new PagedResult<LoyaltyTransactionDto>
        {
            Items = result.Items.Select(t =>
            {
                var (name, phone) = pMap.TryGetValue(t.ParticipantId, out var info) ? info : (null, null);
                return ToTxDto(t, name, phone);
            }).ToList(),
            Total = result.Total, Page = result.Page, Limit = result.Limit,
        };
    }

    public Task<int> GetBalanceAsync(Guid participantId, CancellationToken ct)
        => uow.LoyaltyTransactions.GetBalanceAsync(participantId, ct);

    public async Task<LoyaltyRuleDto?> GetRuleByActionKeyAsync(string actionKey, CancellationToken ct)
    {
        var rule = await uow.LoyaltyRules.GetByActionKeyAsync(actionKey, ct);
        return rule is null ? null : ToRuleDto(rule);
    }

    public async Task AwardPointsAsync(AwardPointsRequest req, CancellationToken ct)
    {
        var rule = await uow.LoyaltyRules.GetByActionKeyAsync(req.ActionKey, ct);
        if (rule is null || !rule.IsActive) return;

        var points = req.PointsOverride ?? rule.Points;
        if (points <= 0) return;

        // RACE CONDITION KORUMASI: idempotency kontrolü ("var mı?") ile kaydın yazılması
        // ("SaveChangesAsync") arasında lock olmadan iki eşzamanlı çağrı aynı anda "yok"
        // sonucunu görüp ikisi de puan yazabiliyordu (bakiye fazlası — bkz. GiftApplicationService/
        // SpinService/RedeemRewardAsync'teki aynı desendeki Redis advisory lock çözümü). Katılımcı
        // bazlı kilit, aynı participant için AwardPointsAsync çağrılarını serileştirir.
        var lockKey = $"loyalty:award-lock:{req.ParticipantId}";
        var lockToken = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(10), ct);
        if (lockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        try
        {
            // İDEMPOTENCY: aynı (participantId, actionKey, referenceId) üçlüsü için ikinci kez
            // ödül verilmesini merkezi olarak engeller. Bu, tek tek çağıran servislerin (quiz,
            // survey, event, travel vb.) her birinin ayrı ayrı doğru referenceId seçmesine ve
            // ayrıca eşzamanlı/tekrar çağrılarda çift ödül verilmesine karşı son bir güvenlik ağı
            // sağlar (bkz. docs/quiz-allowretry-puan-coklama-2026-07-30 bulgusu — aynı quiz'e
            // AllowRetry=true iken art arda/eşzamanlı cevap göndererek sınırsız puan biriktirme).
            if (!string.IsNullOrWhiteSpace(req.ReferenceId) &&
                await uow.LoyaltyTransactions.ExistsAsync(req.ParticipantId, req.ActionKey, req.ReferenceId, ct))
                return;

            var streak = await uow.DailyStreaks.GetByParticipantAsync(req.ParticipantId, ct);
            bool isNewAwardStreak = streak is null;
            streak ??= DailyStreak.Create(req.ParticipantId);
            if (isNewAwardStreak)
                await uow.DailyStreaks.AddAsync(streak, ct);

            var balance = await uow.LoyaltyTransactions.GetBalanceAsync(req.ParticipantId, ct);
            var tx = LoyaltyTransaction.Create(req.ParticipantId, req.ActionKey, rule.Label,
                points, balance + points, req.ReferenceId);
            await uow.LoyaltyTransactions.AddAsync(tx, ct);
            streak.AddPoints(points);
            if (!isNewAwardStreak)
                uow.DailyStreaks.Update(streak);
            await uow.SaveChangesAsync(ct);
        }
        finally
        {
            await redis.ReleaseLockAsync(lockKey, lockToken, ct);
        }
    }

    /// <summary>
    /// Yönetici tarafından serbest miktarda, gerekçeli manuel puan verme. Önceki
    /// `AwardPointsAsync("admin_grant",...)` çağrısı hem kural DB'de tanımsız olduğu
    /// için sessizce hiçbir şey yapmıyordu, hem de sabit kural puanı dışında bir tutar
    /// girişini desteklemiyordu, hem de audit log tutmuyordu (bkz. docs/SADAKAT-LOYALTY-
    /// ADMIN-GRANT-CANLI-TEST-RAPORU-2026-07-29.md, P0 bulgusu). Bu metod: (1) sıfır/negatif
    /// tutarı reddeder, (2) boş gerekçeyi reddeder, (3) LoyaltyTransaction'ı doğrudan
    /// "admin_grant" action key'iyle yazar (LoyaltyRule'a bağımlı değil), (4) kimin/ne
    /// zaman/ne kadar/hangi gerekçeyle verdiğini AuditEntry'ye kaydeder.
    /// </summary>
    public async Task<LoyaltyTransactionDto> AdminGrantPointsAsync(AdminGrantPointsRequest req, CancellationToken ct)
    {
        if (req.Points <= 0)
            throw new ConflictException("Verilecek puan 0'dan büyük olmalıdır.", "INVALID_POINTS");
        if (string.IsNullOrWhiteSpace(req.Description))
            throw new ConflictException("Puan verme gerekçesi zorunludur.", "REASON_REQUIRED");

        var participant = await uow.Participants.GetByIdAsync(req.ParticipantId, ct)
            ?? throw new NotFoundException("Katılımcı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var streak = await uow.DailyStreaks.GetByParticipantAsync(req.ParticipantId, ct);
        bool isNewAwardStreak = streak is null;
        streak ??= DailyStreak.Create(req.ParticipantId);
        if (isNewAwardStreak)
            await uow.DailyStreaks.AddAsync(streak, ct);

        var balance = await uow.LoyaltyTransactions.GetBalanceAsync(req.ParticipantId, ct);
        var tx = LoyaltyTransaction.Create(req.ParticipantId, "admin_grant", req.Description.Trim(),
            req.Points, balance + req.Points, null);
        await uow.LoyaltyTransactions.AddAsync(tx, ct);
        streak.AddPoints(req.Points);
        if (!isNewAwardStreak)
            uow.DailyStreaks.Update(streak);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "LoyaltyTransaction",
            EntityId = tx.Id,
            Module = "Loyalty",
            Description = $"Manuel puan verildi: {participant.FullName} — {req.Points} puan — Gerekçe: {req.Description.Trim()}",
            ActorUserId = currentUser.Id,
            ActorUserName = currentUser.Name,
        }, ct);

        return ToTxDto(tx, participant.FullName, participant.Phone);
    }

    public async Task<List<RewardDto>> GetRewardCatalogAsync(int limit, CancellationToken ct)
    {
        var rewards = await uow.Rewards.GetCatalogAsync(limit, ct);
        return rewards.Select(ToRewardDto).ToList();
    }

    public async Task<RedeemResultDto> RedeemRewardAsync(Guid participantId, Guid rewardId, CancellationToken ct)
    {
        var participantLock = $"loyalty:redeem-lock:{participantId}";
        var rewardLock = $"loyalty:redeem-lock:reward:{rewardId}";
        var participantLockToken = await redis.TryAcquireLockAsync(participantLock, TimeSpan.FromSeconds(10), ct);
        if (participantLockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        try
        {
            var rewardLockToken = await redis.TryAcquireLockAsync(rewardLock, TimeSpan.FromSeconds(10), ct);
            if (rewardLockToken is null)
                throw new ConflictException("Bu hediye için yoğun talep var, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

            try
            {
            var reward = await uow.Rewards.GetByIdAsync(rewardId, ct)
                ?? throw new NotFoundException("Hediye bulunamadı.", "REWARD_NOT_FOUND");

            if (!reward.IsActive || reward.Stock <= 0)
                throw new ConflictException("Bu hediye şu anda mevcut değil.", "REWARD_OUT_OF_STOCK");

            var balance = await uow.LoyaltyTransactions.GetBalanceAsync(participantId, ct);
            if (balance < reward.PointsRequired)
                throw new ConflictException(
                    $"Yeterli puanınız yok. Gerekli: {reward.PointsRequired}, Mevcut: {balance}.",
                    "INSUFFICIENT_POINTS");

            if (!reward.TryRedeem())
                throw new ConflictException("Hediye stoku tükendi.", "REWARD_OUT_OF_STOCK");

            int spent = -reward.PointsRequired;
            int newBalance = balance + spent;

            var tx = LoyaltyTransaction.Create(participantId, "reward_redeem",
                $"{reward.Name} hediyesi talep edildi", spent, newBalance);
            await uow.LoyaltyTransactions.AddAsync(tx, ct);

            var redemption = RewardRedemption.Create(participantId, rewardId, reward.Name, reward.PointsRequired, newBalance);
            await uow.RewardRedemptions.AddAsync(redemption, ct);

            uow.Rewards.Update(reward);
            await uow.SaveChangesAsync(ct);

            return new RedeemResultDto(true, $"{reward.Name} başarıyla talep edildi!", newBalance);
            }
            finally
            {
                await redis.ReleaseLockAsync(rewardLock, rewardLockToken, ct);
            }
        }
        finally
        {
            await redis.ReleaseLockAsync(participantLock, participantLockToken, ct);
        }
    }

    public async Task<PagedResult<RewardDto>> GetRewardsPagedAsync(RewardListParams p, CancellationToken ct)
    {
        var result = await uow.Rewards.GetPagedAsync(p, ct);
        return new PagedResult<RewardDto>
        {
            Items = result.Items.Select(ToRewardDto).ToList(),
            Total = result.Total, Page = result.Page, Limit = result.Limit,
        };
    }

    public async Task<RewardDto> CreateRewardAsync(CreateRewardRequest req, CancellationToken ct)
    {
        var reward = Reward.Create(req.Name, req.PointsRequired, req.Stock, req.Description, req.ImageUrl);
        await uow.Rewards.AddAsync(reward, ct);
        await uow.SaveChangesAsync(ct);
        return ToRewardDto(reward);
    }

    public async Task<RewardDto> UpdateRewardAsync(Guid id, UpdateRewardRequest req, CancellationToken ct)
    {
        var reward = await uow.Rewards.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "REWARD_NOT_FOUND");
        reward.Update(req.Name, req.PointsRequired, req.Stock, req.IsActive, req.Description, req.ImageUrl);
        uow.Rewards.Update(reward);
        await uow.SaveChangesAsync(ct);
        return ToRewardDto(reward);
    }

    public async Task DeleteRewardAsync(Guid id, CancellationToken ct)
    {
        var reward = await uow.Rewards.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "REWARD_NOT_FOUND");
        uow.Rewards.Delete(reward);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<RewardDto> ToggleRewardStatusAsync(Guid id, CancellationToken ct)
    {
        var reward = await uow.Rewards.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Hediye bulunamadı.", "REWARD_NOT_FOUND");
        reward.Update(reward.Name, reward.PointsRequired, reward.Stock, !reward.IsActive, reward.Description, reward.ImageUrl);
        uow.Rewards.Update(reward);
        await uow.SaveChangesAsync(ct);
        return ToRewardDto(reward);
    }

    private async Task<LoyaltyStreakDto> BuildStreakDtoAsync(DailyStreak streak, CancellationToken ct)
    {
        var dailyRule = await uow.LoyaltyRules.GetByActionKeyAsync("daily_login", ct);
        var streakRule = await uow.LoyaltyRules.GetByActionKeyAsync("daily_login_streak_7", ct);
        int dailyPoints = dailyRule?.IsActive == true ? dailyRule.Points : 10;
        int bonusPoints = streakRule?.IsActive == true ? streakRule.Points : 50;
        return BuildStreakDto(streak, dailyPoints, bonusPoints);
    }

    private async Task<LoyaltyStreakDto> BuildEmptyStreakAsync(CancellationToken ct)
    {
        var dailyRule = await uow.LoyaltyRules.GetByActionKeyAsync("daily_login", ct);
        var streakRule = await uow.LoyaltyRules.GetByActionKeyAsync("daily_login_streak_7", ct);
        int dailyPoints = dailyRule?.IsActive == true ? dailyRule.Points : 10;
        int bonusPoints = streakRule?.IsActive == true ? streakRule.Points : 50;
        int todayNumber = DailyStreak.DayNumberOf(TodayLocal());
        var days = Enumerable.Range(1, StreakTarget)
            .Select(d => new StreakDayDto(d, false, d == todayNumber, d > todayNumber))
            .ToList();
        // Hafta içinde ilk kez giren kullanıcı geçmiş günleri dolduramaz;
        // bonus ancak Pazartesi başlayanlar için mümkündür.
        return new LoyaltyStreakDto(
            0, 0, 0, null, days, StreakTarget, dailyPoints, bonusPoints,
            CycleProgress: 0,
            DaysToReward: todayNumber == 1 ? StreakTarget : 0,
            CheckedInToday: false, StreakBroken: false);
    }

    /// <summary>
    /// Seri ilerlemesini Pazartesi–Pazar takvim haftası olarak üretir.
    ///
    /// Kutular haftanın günleridir: 1. kutu Pazartesi, 7. kutu Pazar. Giriş
    /// yapılan gün dolar, yapılmayan gün boş kalır ve o gün geri kazanılamaz.
    /// Bonus yalnızca yedi günün tamamında giriş yapıldıysa verilir
    /// (bkz. <see cref="DailyStreak.CheckIn"/>); hafta bittiğinde herkes için
    /// maske sıfırlanır ve yeni hafta baştan başlar.
    /// </summary>
    private static LoyaltyStreakDto BuildStreakDto(DailyStreak streak, int dailyPoints, int bonusPoints)
    {
        var today = TodayLocal();
        bool checkedInToday = streak.LastCheckInDate == today;

        // Maske yalnızca içinde bulunulan haftaya aitse geçerlidir; kayıtlı
        // hafta geçmişte kaldıysa bu hafta henüz hiç giriş yapılmamış demektir.
        var weekStart = DailyStreak.WeekStartOf(today);
        bool maskCurrent = streak.WeekStartDate == weekStart;

        int todayNumber = DailyStreak.DayNumberOf(today);
        var days = new List<StreakDayDto>();
        for (int dayNumber = 1; dayNumber <= StreakTarget; dayNumber++)
        {
            bool isCompleted = maskCurrent && streak.IsDayChecked(dayNumber);
            bool isToday = dayNumber == todayNumber;
            bool isFuture = dayNumber > todayNumber;
            days.Add(new StreakDayDto(dayNumber, isCompleted, isToday, isFuture));
        }

        int cycleProgress = maskCurrent ? streak.WeekCheckInCount : 0;

        // Bonus için haftanın kalan günlerinin tamamına girilmesi gerekir;
        // bir gün kaçırıldıysa bu hafta ödül artık mümkün değildir.
        bool missedThisWeek = days.Any(d => !d.IsCompleted && d.DayNumber < todayNumber);
        int daysToReward = missedThisWeek ? 0 : StreakTarget - cycleProgress;

        // Bu hafta bir gün kaçırıldıysa kullanıcı bilgilendirilir.
        bool streakBroken = missedThisWeek;

        return new LoyaltyStreakDto(
            streak.CurrentStreak, streak.LongestStreak, streak.TotalPoints,
            streak.LastCheckInDate?.ToString("yyyy-MM-dd"), days,
            Target: StreakTarget, DailyPoints: dailyPoints, BonusPoints: bonusPoints,
            CycleProgress: cycleProgress, DaysToReward: daysToReward,
            CheckedInToday: checkedInToday, StreakBroken: streakBroken);
    }

    private static LoyaltyRuleDto ToRuleDto(LoyaltyRule r) =>
        new(r.Id.ToString(), r.ActionKey, r.Label, r.Points, r.IsActive, r.Description);

    private static LoyaltyTransactionDto ToTxDto(LoyaltyTransaction t, string? participantName = null, string? participantPhone = null)
    {
        string type = t.Points >= 0 ? "Earn" : "Spent";
        string description = t.Points >= 0
            ? $"+{t.Points} puan kazanıldı"
            : $"{Math.Abs(t.Points)} puan harcandı";
        return new(t.Id.ToString(), t.ActionKey, t.Label, t.Points, t.BalanceAfter,
            t.ReferenceId, t.EarnedAt, type, description,
            t.ParticipantId.ToString(), participantName, participantPhone);
    }

    public async Task<PagedResult<RewardRedemptionDto>> GetRedemptionsAsync(RedemptionListParams p, CancellationToken ct)
    {
        var paged = await uow.RewardRedemptions.GetPagedAsync(p, ct);
        var participantIds = paged.Items.Select(r => r.ParticipantId).Distinct().ToList();
        var rewardIds = paged.Items.Select(r => r.RewardId).Distinct().ToList();

        var participants = await uow.Participants.FindAsync(x => participantIds.Contains(x.Id), ct);
        var rewards = await uow.Rewards.FindAsync(x => rewardIds.Contains(x.Id), ct);

        var nameMap = participants.ToDictionary(x => x.Id, x => x.FullName);
        var imageMap = rewards.ToDictionary(x => x.Id, x => x.ImageUrl);

        var items = paged.Items.Select(r => new RewardRedemptionDto(
            r.Id,
            r.ParticipantId,
            nameMap.TryGetValue(r.ParticipantId, out var name) ? name : "—",
            r.RewardId,
            r.RewardName,
            imageMap.TryGetValue(r.RewardId, out var img) ? img : null,
            r.PointsSpent,
            r.Status,
            r.RedeemedAt,
            r.CancelledAt,
            r.CancelReason
        )).ToList();

        return new PagedResult<RewardRedemptionDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task CancelRedemptionAsync(Guid redemptionId, string? reason, CancellationToken ct)
    {
        // RACE CONDITION KORUMASI: RedeemRewardAsync'deki gibi redemption bazlı Redis
        // kilidi. Önceden burada hiç kilit yoktu — aynı redemption'a art arda/eşzamanlı
        // gönderilen iptal istekleri "Status == Cancelled" kontrolünü ikisi de commit
        // öncesi geçebiliyor, bu da AYNI talep için birden fazla "reward_cancel" puan
        // iadesi transaction'ı yazılmasına yol açıyordu (canlı test: 5 eşzamanlı istek,
        // 3'ü 204 başarı döndü, katılımcı 1 puanlık talep için 3 kez +1 puan aldı —
        // bakiye gerçek toplamdan 2 puan fazla çıktı). Kilit, önce Status kontrolünü
        // önce kritik bölgeye taşıyarak ikinci isteğin artık güncel "Cancelled" durumunu
        // görüp 409 ALREADY_CANCELLED ile reddedilmesini garanti eder.
        var lockKey = $"loyalty:redemption-cancel-lock:{redemptionId}";
        var lockToken = await redis.TryAcquireLockAsync(lockKey, TimeSpan.FromSeconds(10), ct);
        if (lockToken is null)
            throw new ConflictException("İşleminiz işleniyor, lütfen birkaç saniye sonra tekrar deneyin.", "OPERATION_IN_PROGRESS");

        try
        {
            var r = await uow.RewardRedemptions.GetByIdAsync(redemptionId, ct)
                ?? throw new NotFoundException("Talep bulunamadı.", "REDEMPTION_NOT_FOUND");

            if (r.Status == "Cancelled")
                throw new ConflictException("Bu talep zaten iptal edilmiş.", "ALREADY_CANCELLED");

            r.Cancel(reason);

            var balance = await uow.LoyaltyTransactions.GetBalanceAsync(r.ParticipantId, ct);
            var refund = LoyaltyTransaction.Create(r.ParticipantId, "reward_cancel",
                $"{r.RewardName} iptali — puan iadesi", r.PointsSpent, balance + r.PointsSpent);
            await uow.LoyaltyTransactions.AddAsync(refund, ct);

            var reward = await uow.Rewards.GetByIdAsync(r.RewardId, ct);
            if (reward is not null)
            {
                reward.RestoreStockAfterCancel();
                uow.Rewards.Update(reward);
            }

            uow.RewardRedemptions.Update(r);
            await uow.SaveChangesAsync(ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.Cancel,
                EntityType = "RewardRedemption",
                EntityId = r.Id,
                Module = "Loyalty",
                Description = $"Ödül talebi iptal edildi: {r.RewardName} ({r.PointsSpent} puan iade edildi)",
                AdditionalDataJson = reason is null ? null : JsonSerializer.Serialize(new { reason }),
            }, ct);
        }
        finally
        {
            await redis.ReleaseLockAsync(lockKey, lockToken, ct);
        }
    }

    public Task<int> GetPendingRedemptionCountAsync(CancellationToken ct)
        => uow.RewardRedemptions.CountPendingAsync(ct);

    public async Task<RewardRedemptionDto> ClaimRedemptionAsync(Guid participantId, Guid redemptionId, CancellationToken ct)
    {
        var r = await uow.RewardRedemptions.GetByIdAsync(redemptionId, ct)
            ?? throw new NotFoundException("Talep bulunamadı.", "REDEMPTION_NOT_FOUND");

        if (r.ParticipantId != participantId)
            throw new ForbiddenException("Bu talebe erişim yetkiniz yok.", "REDEMPTION_FORBIDDEN");

        if (r.Status == "Cancelled")
            throw new ConflictException("İptal edilmiş talep teslim alınamaz.", "REDEMPTION_CANCELLED");

        if (r.Status == "Completed")
            throw new ConflictException("Bu talep zaten teslim alınmış.", "ALREADY_CLAIMED");

        r.Complete();
        uow.RewardRedemptions.Update(r);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.CheckOut,
            EntityType = "RewardRedemption",
            EntityId = r.Id,
            Module = "Loyalty",
            Description = $"Ödül teslim alındı: {r.RewardName}",
        }, ct);

        var participant = await uow.Participants.GetByIdAsync(r.ParticipantId, ct);
        var reward = await uow.Rewards.GetByIdAsync(r.RewardId, ct);

        return new RewardRedemptionDto(
            r.Id,
            r.ParticipantId,
            participant?.FullName ?? "—",
            r.RewardId,
            r.RewardName,
            reward?.ImageUrl,
            r.PointsSpent,
            r.Status,
            r.RedeemedAt,
            r.CancelledAt,
            r.CancelReason
        );
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");
        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct);
        return result.Url;
    }

    private static RewardDto ToRewardDto(Reward r) =>
        new(r.Id.ToString(), r.Name, r.PointsRequired, r.ImageUrl, r.Stock, r.Description, r.IsActive);
}
