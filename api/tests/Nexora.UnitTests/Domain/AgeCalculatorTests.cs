using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class AgeCalculatorTests
{
    [Fact]
    public void Dogum_gunu_gelmediyse_yas_bir_eksik()
    {
        var today = new DateTime(2026, 8, 2);
        Assert.Equal(17, AgeCalculator.At(new DateTime(2008, 12, 31), today));
    }

    [Fact]
    public void Dogum_gunu_tam_bugunse_yas_dolmus_sayilir()
    {
        var today = new DateTime(2026, 8, 2);
        Assert.Equal(18, AgeCalculator.At(new DateTime(2008, 8, 2), today));
    }

    [Fact]
    public void Dogum_gunu_yarin_ise_henuz_dolmamis()
    {
        var today = new DateTime(2026, 8, 2);
        Assert.Equal(17, AgeCalculator.At(new DateTime(2008, 8, 3), today));
    }

    [Fact]
    public void Dogum_gunu_dun_ise_dolmus()
    {
        var today = new DateTime(2026, 8, 2);
        Assert.Equal(18, AgeCalculator.At(new DateTime(2008, 8, 1), today));
    }

    [Fact]
    public void Artik_yil_29_subat_dogumlu_artik_olmayan_yilda_1_mart_gunu_yas_alir()
    {
        Assert.Equal(3, AgeCalculator.At(new DateTime(2020, 2, 29), new DateTime(2023, 3, 1)));
        Assert.Equal(2, AgeCalculator.At(new DateTime(2020, 2, 29), new DateTime(2023, 2, 28)));
    }

    [Fact]
    public void Gelecek_tarihli_dogum_negatif_degil_sifir_doner()
    {
        Assert.Equal(0, AgeCalculator.At(new DateTime(2030, 1, 1), new DateTime(2026, 8, 2)));
    }

    [Fact]
    public void Saat_bileseni_sonucu_degistirmez()
    {
        var birth = new DateTime(2008, 8, 2, 23, 59, 0);
        var todayEarly = new DateTime(2026, 8, 2, 0, 1, 0);
        var todayLate = new DateTime(2026, 8, 2, 23, 59, 0);
        Assert.Equal(18, AgeCalculator.At(birth, todayEarly));
        Assert.Equal(18, AgeCalculator.At(birth, todayLate));
    }

    [Fact]
    public void IsMinor_18_esikte_yetiskin_sayilir()
    {
        var today = TurkeyTime.TodayDate();
        Assert.False(AgeCalculator.IsMinor(today.AddYears(-18)));
        Assert.True(AgeCalculator.IsMinor(today.AddYears(-18).AddDays(1)));
    }

    [Fact]
    public void IsMinor_null_dogum_tarihi_kucuk_saymaz()
    {
        Assert.False(AgeCalculator.IsMinor((DateTime?)null));
    }

    [Fact]
    public void Today_TurkiyeTakvimini_kullanir_UtcNow_degil()
    {
        var utcNow = DateTime.UtcNow;
        var turkeyToday = TurkeyTime.TodayDate();

        var birthTurkeyBirthday = turkeyToday.AddYears(-18);

        Assert.Equal(18, AgeCalculator.Today(birthTurkeyBirthday));
        Assert.False(AgeCalculator.IsMinor(birthTurkeyBirthday));

        var naiveUtcAge = AgeCalculator.At(birthTurkeyBirthday, utcNow);
        if (utcNow.Date < turkeyToday.Date)
            Assert.Equal(17, naiveUtcAge);
    }

    [Fact]
    public void FacilityEligibilityRules_AgeAt_ile_ayni_sonucu_verir()
    {
        var today = new DateTime(2026, 8, 2);
        foreach (var birth in new[]
        {
            new DateTime(2008, 8, 1), new DateTime(2008, 8, 2), new DateTime(2008, 8, 3),
            new DateTime(1970, 1, 1), new DateTime(2020, 2, 29),
        })
        {
            Assert.Equal(FacilityEligibilityRules.AgeAt(birth, today), AgeCalculator.At(birth, today));
            Assert.Equal(EventEligibilityRules.AgeAt(birth, today), AgeCalculator.At(birth, today));
        }
    }
}
