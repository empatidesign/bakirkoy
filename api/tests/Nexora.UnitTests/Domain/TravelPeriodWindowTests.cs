using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class TravelPeriodWindowTests
{
    // V09: gezi StartDate UTC saklanır (TurkeyDateTimeConverter). Pencere Türkiye takviminde kurulmalı.
    // Reviewer vakası: TR 2027-01-01 00:30 → UTC 2026-12-31T21:30Z → yearly penceresi 2027 (TR) olmalı, 2026 DEĞİL.
    [Fact]
    public void Yearly_TR_yil_basi_ilk_saati_dogru_yila_dusuyor_V09()
    {
        var trNewYearUtc = new DateTime(2026, 12, 31, 21, 30, 0, DateTimeKind.Utc); // TR 2027-01-01 00:30
        var (start, end) = TravelRestrictionRules.PeriodWindow("yearly", trNewYearUtc);

        Assert.True(trNewYearUtc >= start && trNewYearUtc < end, "TR 2027 tarihi 2027 penceresinde olmalı");
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2027, 1, 1)), start);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2028, 1, 1)), end);

        // Aynı pencere TR 2026'daki bir tarihi İÇERMEMELİ.
        var trMid2026Utc = TurkeyTime.ToUtc(new DateTime(2026, 6, 1));
        Assert.True(trMid2026Utc < start, "TR 2026 tarihi 2027 penceresinin dışında olmalı");
    }

    [Fact]
    public void Monthly_pencere_TR_takviminde_kurulur()
    {
        var trMonthStartUtc = TurkeyTime.ToUtc(new DateTime(2026, 3, 1)); // TR Mart 1
        var (start, end) = TravelRestrictionRules.PeriodWindow("monthly", trMonthStartUtc);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 3, 1)), start);
        Assert.Equal(TurkeyTime.ToUtc(new DateTime(2026, 4, 1)), end);
    }
}
