using Nexora.Domain.Entities.ServiceFacilities;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class ServiceFacilityHoursTests
{
    private static ServiceFacility New() => ServiceFacility.Create("Test Tesis", "sports", FacilityLocationType.Indoor);

    [Fact]
    public void SetHours_null_degerleri_bos_stringe_cevirir()
    {
        var f = New();
        f.SetHours(null, null, null, null);
        Assert.Equal("", f.WeekdayOpen);
        Assert.Equal("", f.WeekdayClose);
        Assert.Equal("", f.WeekendOpen);
        Assert.Equal("", f.WeekendClose);
    }

    [Fact]
    public void SetHours_kismi_null_karisik_degerleri_dogru_yazar()
    {
        var f = New();
        f.SetHours("08:00", null, "09:00", null);
        Assert.Equal("08:00", f.WeekdayOpen);
        Assert.Equal("", f.WeekdayClose);
        Assert.Equal("09:00", f.WeekendOpen);
        Assert.Equal("", f.WeekendClose);
    }

    [Fact]
    public void SetHours_gecerli_degerleri_oldugu_gibi_korur()
    {
        var f = New();
        f.SetHours("08:00", "22:00", "09:00", "20:00");
        Assert.Equal("08:00", f.WeekdayOpen);
        Assert.Equal("22:00", f.WeekdayClose);
        Assert.Equal("09:00", f.WeekendOpen);
        Assert.Equal("20:00", f.WeekendClose);
    }

    [Fact]
    public void Yeni_tesis_saatleri_varsayilan_bos_stringtir()
    {
        var f = New();
        Assert.Equal("", f.WeekdayOpen);
        Assert.Equal("", f.WeekendClose);
    }
}
