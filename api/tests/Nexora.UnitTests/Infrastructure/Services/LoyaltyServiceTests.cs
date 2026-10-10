using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Domain.Common;
using Nexora.Domain.Entities.Loyalty;
using Nexora.Infrastructure.Services;
using Nexora.Infrastructure.Storage;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class LoyaltyServiceTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IRewardRepository> _rewards = new();
    private readonly Mock<ILoyaltyTransactionRepository> _transactions = new();
    private readonly Mock<IRewardRedemptionRepository> _redemptions = new();
    private readonly Mock<ILoyaltyRuleRepository> _rules = new();
    private readonly Mock<IDailyStreakRepository> _streaks = new();
    private readonly Mock<IRedisService> _redis = new();
    private readonly LoyaltyService _service;

    public LoyaltyServiceTests()
    {
        _uow.SetupGet(x => x.Rewards).Returns(_rewards.Object);
        _uow.SetupGet(x => x.LoyaltyTransactions).Returns(_transactions.Object);
        _uow.SetupGet(x => x.RewardRedemptions).Returns(_redemptions.Object);
        _uow.SetupGet(x => x.LoyaltyRules).Returns(_rules.Object);
        _uow.SetupGet(x => x.DailyStreaks).Returns(_streaks.Object);
        _uow.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _redis.Setup(x => x.TryAcquireLockAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>())).ReturnsAsync("lock-token");
        _redis.Setup(x => x.ReleaseLockAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        _service = new LoyaltyService(
            _uow.Object,
            new ServiceCollection().BuildServiceProvider(),
            _redis.Object,
            Mock.Of<IAuditService>(),
            Mock.Of<ICurrentUser>(),
            Mock.Of<IOptionsMonitor<MinioSettings>>(m => m.CurrentValue == new MinioSettings()));
    }

    [Fact]
    public async Task RedeemRewardAsync_yeterli_puan_ve_stok_varsa_transaction_redemption_olusturur()
    {
        var participantId = Guid.NewGuid();
        var rewardId = Guid.NewGuid();
        var reward = Reward.Create("Sinema Bileti", 150, 2);
        SetId(reward, rewardId);
        _rewards.Setup(x => x.GetByIdAsync(rewardId, It.IsAny<CancellationToken>())).ReturnsAsync(reward);
        _transactions.Setup(x => x.GetBalanceAsync(participantId, It.IsAny<CancellationToken>())).ReturnsAsync(200);

        var result = await _service.RedeemRewardAsync(participantId, rewardId, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal(50, result.BalanceAfter);
        Assert.Equal(1, reward.Stock);
        _transactions.Verify(x => x.AddAsync(It.Is<LoyaltyTransaction>(t =>
            t.ParticipantId == participantId && t.ActionKey == "reward_redeem" && t.Points == -150 && t.BalanceAfter == 50),
            It.IsAny<CancellationToken>()), Times.Once);
        _redemptions.Verify(x => x.AddAsync(It.Is<RewardRedemption>(r =>
            r.ParticipantId == participantId && r.RewardId == rewardId && r.PointsSpent == 150 && r.BalanceAfter == 50),
            It.IsAny<CancellationToken>()), Times.Once);
        _rewards.Verify(x => x.Update(reward), Times.Once);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RedeemRewardAsync_bakiye_yetersizse_conflict_firlatir_ve_yazmaz()
    {
        var participantId = Guid.NewGuid();
        var rewardId = Guid.NewGuid();
        var reward = Reward.Create("Kulaklık", 300, 1);
        _rewards.Setup(x => x.GetByIdAsync(rewardId, It.IsAny<CancellationToken>())).ReturnsAsync(reward);
        _transactions.Setup(x => x.GetBalanceAsync(participantId, It.IsAny<CancellationToken>())).ReturnsAsync(99);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RedeemRewardAsync(participantId, rewardId, CancellationToken.None));

        Assert.Equal("INSUFFICIENT_POINTS", ex.ErrorCode);
        _transactions.Verify(x => x.AddAsync(It.IsAny<LoyaltyTransaction>(), It.IsAny<CancellationToken>()), Times.Never);
        _redemptions.Verify(x => x.AddAsync(It.IsAny<RewardRedemption>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RedeemRewardAsync_stok_yoksa_conflict_firlatir()
    {
        var rewardId = Guid.NewGuid();
        _rewards.Setup(x => x.GetByIdAsync(rewardId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Reward.Create("Tukenmis", 10, 0));

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            _service.RedeemRewardAsync(Guid.NewGuid(), rewardId, CancellationToken.None));

        Assert.Equal("REWARD_OUT_OF_STOCK", ex.ErrorCode);
        _transactions.Verify(x => x.GetBalanceAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AwardPointsAsync_aktif_kural_yoksa_islem_yapmaz()
    {
        _rules.Setup(x => x.GetByActionKeyAsync("survey_complete", It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoyaltyRule?)null);

        await _service.AwardPointsAsync(new AwardPointsRequest(Guid.NewGuid(), "survey_complete", null), CancellationToken.None);

        _transactions.Verify(x => x.AddAsync(It.IsAny<LoyaltyTransaction>(), It.IsAny<CancellationToken>()), Times.Never);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public void DailyStreak_modal_onayi_ayni_gun_tekrar_gostermez_yeni_gunde_gosterir()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        var firstDay = new DateOnly(2026, 8, 28);

        streak.CheckIn(firstDay, 10, 50);
        Assert.True(streak.ShouldShowModal);
        Assert.True(streak.AcknowledgeModal());
        Assert.False(streak.ShouldShowModal);
        Assert.False(streak.AcknowledgeModal());

        streak.CheckIn(firstDay.AddDays(1), 10, 50);
        Assert.True(streak.ShouldShowModal);
    }

    [Fact]
    public async Task AcknowledgeStreakModalAsync_bekleyen_modali_kapatir()
    {
        var participantId = Guid.NewGuid();
        var streak = DailyStreak.Create(participantId);
        streak.CheckIn(new DateOnly(2026, 8, 28), 10, 50);
        _streaks.Setup(x => x.GetByParticipantAsync(participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(streak);

        await _service.AcknowledgeStreakModalAsync(participantId, CancellationToken.None);

        Assert.False(streak.ShouldShowModal);
        _streaks.Verify(x => x.Update(streak), Times.Once);
        _uow.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private static void SetId(object entity, Guid id)
    {
        var prop = entity.GetType().BaseType?.GetProperty("Id") ?? entity.GetType().GetProperty("Id");
        prop?.SetValue(entity, id);
    }

    // ————— Seri penceresi: Pazartesi–Pazar takvim haftası —————
    //
    // Bonus yalnızca haftanın yedi gününün tamamında giriş yapıldıysa verilir.
    // Kaçırılan gün geri kazanılamaz; hafta bitince maske sıfırlanır.

    private void SetupStreakRules()
    {
        _rules.Setup(x => x.GetByActionKeyAsync("daily_login", It.IsAny<CancellationToken>()))
            .ReturnsAsync(LoyaltyRule.Create("daily_login", "Günlük Giriş", 10, null));
        _rules.Setup(x => x.GetByActionKeyAsync("daily_login_streak_7", It.IsAny<CancellationToken>()))
            .ReturnsAsync(LoyaltyRule.Create("daily_login_streak_7", "7 Günlük Seri", 50, null));
        _transactions.Setup(x => x.GetBalanceAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
    }

    // ——— Domain: takvim mantığı sabit tarihlerle doğrulanır ———

    [Fact]
    public void Hafta_Pazartesi_baslar_Pazar_biter()
    {
        // 2026-09-14 Pazartesi, 2026-09-20 Pazar.
        var monday = new DateOnly(2026, 9, 14);
        var sunday = new DateOnly(2026, 9, 20);

        Assert.Equal(monday, DailyStreak.WeekStartOf(monday));
        Assert.Equal(monday, DailyStreak.WeekStartOf(sunday));
        Assert.Equal(1, DailyStreak.DayNumberOf(monday));
        Assert.Equal(7, DailyStreak.DayNumberOf(sunday));
        // Pazartesi yeni hafta başlatır.
        Assert.Equal(sunday.AddDays(1), DailyStreak.WeekStartOf(sunday.AddDays(1)));
    }

    [Fact]
    public void Gun_kacirilsa_bile_sonraki_gun_puan_alinir_seri_sifirlanmaz()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        var monday = new DateOnly(2026, 9, 14);

        // Pazartesi girildi, Salı atlandı, Çarşamba girildi.
        var (_, mondayPoints, _) = streak.CheckIn(monday, 10, 50);
        var (isNew, wednesdayPoints, bonus) = streak.CheckIn(monday.AddDays(2), 10, 50);

        Assert.Equal(10, mondayPoints);
        Assert.True(isNew);
        Assert.Equal(10, wednesdayPoints);   // kaçırılan gün puanı engellemez
        Assert.Equal(0, bonus);
        Assert.True(streak.IsDayChecked(1));   // Pazartesi
        Assert.False(streak.IsDayChecked(2));  // Salı — geri kazanılamaz
        Assert.True(streak.IsDayChecked(3));   // Çarşamba
        Assert.Equal(2, streak.WeekCheckInCount);
    }

    [Fact]
    public void Bonus_yalnizca_yedi_gunun_tamaminda_verilir()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        var monday = new DateOnly(2026, 9, 14);

        // Pazartesi'den Cumartesi'ye kadar altı gün: henüz bonus yok.
        for (int i = 0; i < 6; i++)
            Assert.Equal(0, streak.CheckIn(monday.AddDays(i), 10, 50).streakBonusEarned);

        // Pazar günü hafta tamamlanır.
        var (_, daily, bonus) = streak.CheckIn(monday.AddDays(6), 10, 50);
        Assert.Equal(10, daily);
        Assert.Equal(50, bonus);
        Assert.Equal(7, streak.WeekCheckInCount);
    }

    [Fact]
    public void Bir_gun_kacirilan_haftada_bonus_verilmez()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        var monday = new DateOnly(2026, 9, 14);

        // Salı hariç haftanın tüm günleri.
        int totalBonus = 0;
        for (int i = 0; i < 7; i++)
        {
            if (i == 1) continue;
            totalBonus += streak.CheckIn(monday.AddDays(i), 10, 50).streakBonusEarned;
        }

        Assert.Equal(0, totalBonus);
        Assert.Equal(6, streak.WeekCheckInCount);
    }

    [Fact]
    public void Yeni_hafta_basladiginda_maske_sifirlanir()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        var monday = new DateOnly(2026, 9, 14);

        // Önceki haftanın tamamı — bonus alınır.
        for (int i = 0; i < 7; i++) streak.CheckIn(monday.AddDays(i), 10, 50);
        Assert.Equal(7, streak.WeekCheckInCount);

        // Ertesi Pazartesi yeni hafta: sayaç bire döner.
        var (_, _, bonus) = streak.CheckIn(monday.AddDays(7), 10, 50);
        Assert.Equal(0, bonus);
        Assert.Equal(1, streak.WeekCheckInCount);
        Assert.True(streak.IsDayChecked(1));
        Assert.False(streak.IsDayChecked(2));
    }

    [Fact]
    public void Hafta_ortasinda_baslayan_kullanici_o_hafta_bonus_alamaz()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        // 2026-09-18 Cuma: haftanın 5. günü.
        var friday = new DateOnly(2026, 9, 18);
        Assert.Equal(5, DailyStreak.DayNumberOf(friday));

        int totalBonus = 0;
        for (int i = 0; i < 3; i++) // Cuma, Cumartesi, Pazar
            totalBonus += streak.CheckIn(friday.AddDays(i), 10, 50).streakBonusEarned;

        Assert.Equal(0, totalBonus);
        Assert.Equal(3, streak.WeekCheckInCount);
    }

    [Fact]
    public void Ayni_gun_ikinci_giris_puan_vermez()
    {
        var streak = DailyStreak.Create(Guid.NewGuid());
        var monday = new DateOnly(2026, 9, 14);

        streak.CheckIn(monday, 10, 50);
        var (isNew, daily, bonus) = streak.CheckIn(monday, 10, 50);

        Assert.False(isNew);
        Assert.Equal(0, daily);
        Assert.Equal(0, bonus);
        Assert.Equal(1, streak.WeekCheckInCount);
    }

    // ——— Servis: arayüze gönderilen hafta görünümü ———

    [Fact]
    public async Task Kutular_takvim_haftasinin_gunleridir_bugun_dogru_kutudur()
    {
        SetupStreakRules();
        var participantId = Guid.NewGuid();
        var streak = DailyStreak.Create(participantId);
        _streaks.Setup(x => x.GetByParticipantAsync(participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(streak);

        var result = await _service.DailyCheckInAsync(participantId, CancellationToken.None);

        int todayNumber = DailyStreak.DayNumberOf(TurkeyTime.Today());
        Assert.Equal(7, result.Streak.WeekDays.Count);
        Assert.True(result.Streak.CheckedInToday);
        // Bugünün kutusu takvimdeki yerindedir, seri uzunluğuna göre kaymaz.
        Assert.Equal(todayNumber, result.Streak.WeekDays.Single(d => d.IsToday).DayNumber);
        Assert.True(result.Streak.WeekDays.Single(d => d.DayNumber == todayNumber).IsCompleted);
        Assert.Equal(1, result.Streak.CycleProgress);
    }

    [Fact]
    public async Task Bu_hafta_hic_giris_yoksa_ilerleme_sifirdir()
    {
        SetupStreakRules();
        var participantId = Guid.NewGuid();
        var streak = DailyStreak.Create(participantId);
        // Geçen haftaya ait giriş: bu haftanın maskesi boştur.
        streak.CheckIn(DailyStreak.WeekStartOf(TurkeyTime.Today()).AddDays(-7), 10, 50);
        _streaks.Setup(x => x.GetByParticipantAsync(participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(streak);

        var dto = await _service.GetStreakAsync(participantId, CancellationToken.None);

        Assert.False(dto.CheckedInToday);
        Assert.Equal(0, dto.CycleProgress);
        Assert.Equal(0, dto.WeekDays.Count(d => d.IsCompleted));
    }

    [Fact]
    public async Task Gecmis_gun_kacirildiysa_StreakBroken_gelir_ve_odul_imkansizdir()
    {
        SetupStreakRules();
        var participantId = Guid.NewGuid();
        var today = TurkeyTime.Today();
        var weekStart = DailyStreak.WeekStartOf(today);

        // Bu test yalnızca haftanın en az 3. gününde anlamlıdır (kaçırılacak
        // bir geçmiş gün bulunmalı); Pazartesi/Salı ise atlanır.
        if (DailyStreak.DayNumberOf(today) < 3) return;

        var streak = DailyStreak.Create(participantId);
        streak.CheckIn(weekStart, 10, 50);      // Pazartesi girildi
        streak.CheckIn(today, 10, 50);          // aradaki gün(ler) kaçırıldı
        _streaks.Setup(x => x.GetByParticipantAsync(participantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(streak);

        var dto = await _service.GetStreakAsync(participantId, CancellationToken.None);

        Assert.True(dto.StreakBroken);
        Assert.Equal(0, dto.DaysToReward);   // bu hafta bonus artık mümkün değil
        Assert.True(dto.CheckedInToday);
    }
}
