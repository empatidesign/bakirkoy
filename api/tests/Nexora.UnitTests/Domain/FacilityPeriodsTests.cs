using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class FacilityPeriodsTests
{
    [Fact]
    public void Bounds_donem_sinirlarini_verir()
    {
        var start = new DateTime(2026, 1, 1);
        Assert.Equal((new DateTime(2026, 1, 1), new DateTime(2026, 4, 1)), FacilityPeriods.Bounds(start, 3, 0));
        Assert.Equal((new DateTime(2026, 4, 1), new DateTime(2026, 7, 1)), FacilityPeriods.Bounds(start, 3, 1));
        Assert.Equal((new DateTime(2027, 1, 1), new DateTime(2027, 4, 1)), FacilityPeriods.Bounds(start, 3, 4));
    }

    [Fact]
    public void IndexAt_tarihe_gore_dogru_donemi_bulur_yil_siniri_yok()
    {
        var start = new DateTime(2026, 1, 1);
        Assert.Equal(0, FacilityPeriods.IndexAt(start, 3, new DateTime(2026, 2, 15)));
        Assert.Equal(1, FacilityPeriods.IndexAt(start, 3, new DateTime(2026, 5, 1)));
        Assert.Equal(3, FacilityPeriods.IndexAt(start, 3, new DateTime(2026, 12, 31)));
        Assert.Equal(4, FacilityPeriods.IndexAt(start, 3, new DateTime(2027, 1, 1)));
        Assert.Equal(8, FacilityPeriods.IndexAt(start, 3, new DateTime(2028, 1, 1)));
    }

    [Fact]
    public void IndexAt_baslangictan_once_sifir_verir()
    {
        var start = new DateTime(2026, 1, 1);
        Assert.Equal(0, FacilityPeriods.IndexAt(start, 3, new DateTime(2025, 12, 31)));
    }

    [Fact]
    public void IndexAt_bolen_olmayan_aylarda_da_calisir()
    {
        var start = new DateTime(2026, 1, 1);
        Assert.Equal(0, FacilityPeriods.IndexAt(start, 5, new DateTime(2026, 4, 30)));
        Assert.Equal(1, FacilityPeriods.IndexAt(start, 5, new DateTime(2026, 6, 1)));
        Assert.Equal(2, FacilityPeriods.IndexAt(start, 5, new DateTime(2026, 11, 1)));
    }

    [Fact]
    public void PeriodAt_aktif_donemin_penceresini_ve_indexini_verir()
    {
        var start = new DateTime(2026, 1, 1);
        var w = FacilityPeriods.PeriodAt(start, 3, new DateTime(2026, 5, 1));
        Assert.Equal(new DateTime(2026, 4, 1), w.Start);
        Assert.Equal(new DateTime(2026, 7, 1), w.End);
        Assert.Equal(1, w.Index);
    }

    [Fact]
    public void PeriodAt_yildan_sonra_da_donem_verir()
    {
        var start = new DateTime(2026, 1, 1);
        var w = FacilityPeriods.PeriodAt(start, 3, new DateTime(2030, 2, 1));
        Assert.Equal(16, w.Index);
        Assert.Equal(new DateTime(2030, 1, 1), w.Start);
        Assert.Equal(new DateTime(2030, 4, 1), w.End);
    }

    [Fact]
    public void Overlapping_araligi_kesen_donemleri_verir()
    {
        var start = new DateTime(2026, 1, 1);
        var list = FacilityPeriods.Overlapping(start, 3, new DateTime(2026, 3, 15), new DateTime(2026, 6, 15));
        Assert.Equal(2, list.Count);
        Assert.Equal(0, list[0].Index);
        Assert.Equal(1, list[1].Index);
    }

    [Fact]
    public void Overlapping_tek_donem_icindeyse_tek_donem_verir()
    {
        var start = new DateTime(2026, 1, 1);
        var list = FacilityPeriods.Overlapping(start, 3, new DateTime(2026, 1, 10), new DateTime(2026, 3, 20));
        Assert.Single(list);
        Assert.Equal(0, list[0].Index);
    }

    [Fact]
    public void RollingHorizon_bir_donem_ileriyi_verir()
    {
        var start = new DateTime(2026, 1, 1);
        Assert.Equal(new DateTime(2026, 7, 1), FacilityPeriods.RollingHorizon(start, 3, new DateTime(2026, 2, 1), 1));
        Assert.Equal(new DateTime(2026, 10, 1), FacilityPeriods.RollingHorizon(start, 3, new DateTime(2026, 5, 1), 1));
    }

    [Fact]
    public void RollingHorizon_baslangicta_ilk_iki_donemi_kapsar()
    {
        var start = new DateTime(2026, 1, 1);
        Assert.Equal(new DateTime(2026, 7, 1), FacilityPeriods.RollingHorizon(start, 3, start, 1));
    }
}
