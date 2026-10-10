using Nexora.Domain.Entities.Facilities;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class FacilityEntitlementTests
{
    [Fact]
    public void PersonalDuration_ay_bazli_giristen_itibaren_tam_sure_verir()
    {
        var r = FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration,
            new DateTime(2026, 2, 15), "month", 3, 0, new DateTime(2026, 1, 1), new DateTime(2026, 4, 1));

        Assert.Equal(new DateTime(2026, 2, 15), r.Start);
        Assert.Equal(new DateTime(2026, 5, 15), r.End);
    }

    [Fact]
    public void PersonalDuration_otomatik_ve_manuel_ayni_giris_ayni_hak_uretir()
    {
        var eff = new DateTime(2026, 2, 15);
        var auto = FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, eff, "month", 3, 0, new DateTime(2026, 1, 1), new DateTime(2026, 4, 1));
        var manual = FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, eff, "month", 3, 0, new DateTime(2026, 1, 1), new DateTime(2026, 4, 1));
        Assert.Equal(auto, manual);
    }

    [Fact]
    public void PersonalDuration_gun_bazli_7_30_90_gun()
    {
        var eff = new DateTime(2026, 3, 10);
        Assert.Equal(eff.AddDays(7), FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, eff, "day", 0, 7, null, null).End);
        Assert.Equal(eff.AddDays(30), FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, eff, "day", 0, 30, null, null).End);
        Assert.Equal(eff.AddDays(90), FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, eff, "day", 0, 90, null, null).End);
    }

    [Fact]
    public void PersonalDuration_ay_sonu_ve_artik_yil_dogru_kelepceler()
    {
        Assert.Equal(new DateTime(2026, 2, 28), FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, new DateTime(2026, 1, 31), "month", 1, 0, null, null).End);
        Assert.Equal(new DateTime(2025, 2, 28), FacilityEntitlement.Compute(FacilityEntitlementModel.PersonalDuration, new DateTime(2024, 2, 29), "month", 12, 0, null, null).End);
    }

    [Fact]
    public void FixedCalendar_giris_tarihinden_bagimsiz_grup_takvimini_kullanir()
    {
        var r = FacilityEntitlement.Compute(FacilityEntitlementModel.FixedCalendar,
            new DateTime(2026, 2, 15), "month", 3, 0, new DateTime(2026, 1, 1), new DateTime(2026, 4, 1));

        Assert.Equal(new DateTime(2026, 1, 1), r.Start);
        Assert.Equal(new DateTime(2026, 4, 1), r.End);
    }

    [Fact]
    public void FixedCalendar_sabit_kamp_kendiliginden_uzamaz()
    {
        var joinLate = FacilityEntitlement.Compute(FacilityEntitlementModel.FixedCalendar,
            new DateTime(2026, 3, 20), "month", 3, 0, new DateTime(2026, 1, 1), new DateTime(2026, 4, 1));
        Assert.Equal(new DateTime(2026, 4, 1), joinLate.End);
    }

    [Theory]
    [InlineData("recurring", FacilityEntitlementModel.PersonalDuration)]
    [InlineData("date_range", FacilityEntitlementModel.FixedCalendar)]
    [InlineData(null, FacilityEntitlementModel.FixedCalendar)]
    public void DefaultFor_periodType_ile_esler(string? periodType, string expected)
    {
        Assert.Equal(expected, FacilityEntitlementModel.DefaultFor(periodType));
    }

    [Fact]
    public void Normalize_gecersiz_degeri_periodType_varsayilanina_dusurur()
    {
        Assert.Equal(FacilityEntitlementModel.PersonalDuration, FacilityEntitlementModel.Normalize("", "recurring"));
        Assert.Equal(FacilityEntitlementModel.FixedCalendar, FacilityEntitlementModel.Normalize("garbage", "date_range"));
        Assert.Equal(FacilityEntitlementModel.PersonalDuration, FacilityEntitlementModel.Normalize(FacilityEntitlementModel.PersonalDuration, "date_range"));
    }
}
