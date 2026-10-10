using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Loyalty;

public class DailyStreak : BaseEntity
{
    /// <summary>
    /// Ödül periyodu: Pazartesi–Pazar takvim haftası. Arayüzdeki ilerleme
    /// çubuğu da bu değere göre çizilir; ödül koşulu ile gösterim tek
    /// kaynaktan gelir.
    /// </summary>
    public const int BonusPeriodDays = 7;

    public Guid ParticipantId { get; private set; }
    public int CurrentStreak { get; private set; }
    public int LongestStreak { get; private set; }
    public DateOnly? LastCheckInDate { get; private set; }
    public DateOnly? LastModalAcknowledgedCheckInDate { get; private set; }
    public int TotalPoints { get; private set; }

    /// <summary>
    /// İçinde bulunulan haftanın Pazartesi tarihi. Giriş yapılan gün bu
    /// haftanın dışındaysa <see cref="WeekMask"/> sıfırlanır.
    /// </summary>
    public DateOnly? WeekStartDate { get; private set; }

    /// <summary>
    /// Bu hafta giriş yapılan günlerin bit maskesi: bit 0 Pazartesi,
    /// bit 6 Pazar. Bonus yalnızca yedi bitin tamamı doluyken verilir.
    /// </summary>
    public int WeekMask { get; private set; }

    private const int FullWeekMask = (1 << BonusPeriodDays) - 1;

    public bool ShouldShowModal =>
        LastCheckInDate.HasValue && LastModalAcknowledgedCheckInDate != LastCheckInDate;

    public static DailyStreak Create(Guid participantId) => new()
    {
        ParticipantId = participantId,
        CurrentStreak = 0,
        LongestStreak = 0,
        TotalPoints = 0,
        WeekMask = 0,
    };

    /// <summary>Verilen günün içinde bulunduğu Pazartesi.</summary>
    public static DateOnly WeekStartOf(DateOnly day) =>
        day.AddDays(-((int)day.DayOfWeek + 6) % 7);

    /// <summary>Gün numarası: Pazartesi 1 … Pazar 7.</summary>
    public static int DayNumberOf(DateOnly day) => ((int)day.DayOfWeek + 6) % 7 + 1;

    /// <summary>Haftanın <paramref name="dayNumber"/>. gününde giriş yapıldı mı (1..7).</summary>
    public bool IsDayChecked(int dayNumber) => (WeekMask & (1 << (dayNumber - 1))) != 0;

    /// <summary>Bu hafta giriş yapılan gün sayısı.</summary>
    public int WeekCheckInCount => System.Numerics.BitOperations.PopCount((uint)WeekMask);

    public (bool isNewDay, int dailyPointsEarned, int streakBonusEarned) CheckIn(DateOnly today, int dailyPoints, int streakBonusPoints)
    {
        if (LastCheckInDate == today) return (false, 0, 0);

        // Hafta değiştiyse maske sıfırlanır; ödül her hafta baştan kazanılır.
        var weekStart = WeekStartOf(today);
        if (WeekStartDate != weekStart)
        {
            WeekStartDate = weekStart;
            WeekMask = 0;
        }

        WeekMask |= 1 << (DayNumberOf(today) - 1);

        CurrentStreak = WeekCheckInCount;
        if (CurrentStreak > LongestStreak) LongestStreak = CurrentStreak;
        LastCheckInDate = today;

        // Bonus yalnızca haftanın yedi gününün tamamında giriş yapıldıysa.
        var bonus = WeekMask == FullWeekMask ? streakBonusPoints : 0;
        TotalPoints += dailyPoints + bonus;
        UpdatedAt = DateTime.UtcNow;
        return (true, dailyPoints, bonus);
    }

    public void AddPoints(int points)
    {
        TotalPoints += points;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool AcknowledgeModal()
    {
        if (!LastCheckInDate.HasValue || LastModalAcknowledgedCheckInDate == LastCheckInDate)
            return false;

        LastModalAcknowledgedCheckInDate = LastCheckInDate;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }
}
