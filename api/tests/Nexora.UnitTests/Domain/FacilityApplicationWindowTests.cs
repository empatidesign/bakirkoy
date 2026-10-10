using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class FacilityApplicationWindowTests
{
    private static readonly DateTime Today = new(2026, 8, 2);

    private static (string Code, string Message)? Check(
        string? type = "kurs",
        DateTime? appStart = null,
        DateTime? appEnd = null,
        DateTime? periodStart = null,
        DateTime? periodEnd = null,
        string? periodType = null,
        int periodMonths = 0)
        => FacilityApplicationWindow.Check(
            type, appStart, appEnd, periodStart, periodEnd, periodType, periodMonths, Today);

    [Fact]
    public void Pencere_acikken_engel_yok()
    {
        Assert.Null(Check(appStart: Today.AddDays(-5), appEnd: Today.AddDays(5)));
    }

    [Fact]
    public void Tarih_alanlari_bosken_engel_yok()
    {
        Assert.Null(Check());
    }

    [Fact]
    public void Basvuru_baslangici_gelecekteyse_NOT_OPEN()
    {
        var r = Check(appStart: Today.AddDays(1));
        Assert.Equal(FacilityApplicationWindow.NotOpenCode, r!.Value.Code);
    }

    [Fact]
    public void Basvuru_bitisi_gectiyse_CLOSED()
    {
        var r = Check(appEnd: Today.AddDays(-1));
        Assert.Equal(FacilityApplicationWindow.ClosedCode, r!.Value.Code);
    }

    [Fact]
    public void Bugun_baslangic_gunuyse_acik_sayilir()
    {
        Assert.Null(Check(appStart: Today));
    }

    [Fact]
    public void Bugun_bitis_gunuyse_hala_acik_sayilir()
    {
        Assert.Null(Check(appEnd: Today));
    }

    [Fact]
    public void Donem_bittiyse_PERIOD_ENDED()
    {
        var r = Check(periodEnd: Today.AddDays(-1));
        Assert.Equal(FacilityApplicationWindow.PeriodEndedCode, r!.Value.Code);
    }

    [Fact]
    public void Donem_bitisi_basvuru_penceresinden_once_degerlendirilir()
    {
        var r = Check(appStart: Today.AddDays(10), periodEnd: Today.AddDays(-1));
        Assert.Equal(FacilityApplicationWindow.PeriodEndedCode, r!.Value.Code);
    }

    [Fact]
    public void Akademi_basvuru_penceresinden_MUAF()
    {
        Assert.Null(Check(type: "akademi", appStart: Today.AddDays(10)));
        Assert.Null(Check(type: "akademi", appEnd: Today.AddDays(-10)));
        Assert.Null(Check(type: "AKADEMI", appEnd: Today.AddDays(-10)));
    }

    [Fact]
    public void Akademi_muafiyeti_donem_bitisini_KAPSAMAZ()
    {
        var r = Check(type: "akademi", periodEnd: Today.AddDays(-1));
        Assert.Equal(FacilityApplicationWindow.PeriodEndedCode, r!.Value.Code);
    }

    [Fact]
    public void Akademi_disi_tur_muaf_degil()
    {
        var r = Check(type: "kurs", appStart: Today.AddDays(10));
        Assert.Equal(FacilityApplicationWindow.NotOpenCode, r!.Value.Code);
    }

    [Fact]
    public void Tekrarlayan_donem_baslangictan_cok_sonra_da_acik_kalir()
    {
        var periodStart = new DateTime(2025, 1, 1);
        Assert.Null(Check(periodStart: periodStart, periodType: "recurring", periodMonths: 3));
    }

    [Fact]
    public void Tekrarlayan_donem_baslamadan_once_engel_yok()
    {
        var periodStart = new DateTime(2026, 1, 1);
        Assert.Null(Check(periodStart: periodStart, periodType: "recurring", periodMonths: 3));
    }

    [Fact]
    public void Tekrarlayan_donem_kurali_acik_basvuru_bitisi_varken_uygulanmaz()
    {
        Assert.Null(Check(
            appEnd: Today.AddDays(5),
            periodStart: new DateTime(2025, 1, 1),
            periodType: "recurring",
            periodMonths: 3));
    }

    [Fact]
    public void Tekrarlayan_olmayan_donemde_son_donem_kurali_uygulanmaz()
    {
        Assert.Null(Check(
            periodStart: new DateTime(2025, 1, 1),
            periodType: "fixed",
            periodMonths: 3));
    }

    [Fact]
    public void Kullaniciya_giden_mesajlar_turkce_ve_dolu()
    {
        foreach (var msg in new[]
        {
            FacilityApplicationWindow.NotOpenMessage,
            FacilityApplicationWindow.ClosedMessage,
            FacilityApplicationWindow.PeriodEndedMessage,
        })
        {
            Assert.False(string.IsNullOrWhiteSpace(msg));
            Assert.EndsWith(".", msg.Trim());
        }
    }
}
