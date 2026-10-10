using Nexora.Domain.Common;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class EventEligibilityRulesTests
{
    [Theory]
    [InlineData("mixed", Gender.Male)]
    [InlineData("mixed", Gender.Female)]
    [InlineData("male", Gender.Male)]
    [InlineData("female", Gender.Female)]
    public void Uygun_cinsiyet_kabul_edilir(string eventGender, Gender participantGender)
    {
        Assert.Null(EventEligibilityRules.CheckGender(eventGender, participantGender, true));
    }

    [Fact]
    public void Kadin_etkinligine_erkek_reddedilir()
    {
        var violation = EventEligibilityRules.CheckGender("female", Gender.Male, true);

        Assert.NotNull(violation);
        Assert.Equal("GENDER_NOT_ELIGIBLE", violation.ErrorCode);
        Assert.Contains("kadın", violation.Message);
    }

    [Fact]
    public void Erkek_etkinligine_kadin_reddedilir()
    {
        var violation = EventEligibilityRules.CheckGender("male", Gender.Female, true);

        Assert.NotNull(violation);
        Assert.Equal("GENDER_NOT_ELIGIBLE", violation.ErrorCode);
        Assert.Contains("erkek", violation.Message);
    }

    [Fact]
    public void Cinsiyeti_bilinmeyen_kisi_reddedilir_ve_profil_uyarisi_alir()
    {
        var violation = EventEligibilityRules.CheckGender("female", Gender.Unknown, true);

        Assert.NotNull(violation);
        Assert.Equal("GENDER_NOT_ELIGIBLE", violation.ErrorCode);
        Assert.Contains("profil", violation.Message.ToLowerInvariant());
        Assert.Equal("Cinsiyet bilgisi eksik", violation.ShortReason);
    }

    [Theory]
    [InlineData(Gender.Male)]
    [InlineData(Gender.Female)]
    [InlineData(Gender.Unknown)]
    public void Ayar_kapaliyken_cinsiyet_kurali_uygulanmaz(Gender participantGender)
    {
        Assert.Null(EventEligibilityRules.CheckGender("female", participantGender, false));
        Assert.Null(EventEligibilityRules.CheckGender("male", participantGender, false));
    }

    [Theory]
    [InlineData(18, 25, 18)]
    [InlineData(18, 25, 25)]
    [InlineData(18, 25, 22)]
    [InlineData(0, 0, 55)]
    [InlineData(0, 25, 3)]
    [InlineData(18, 0, 90)]
    public void Uygun_yas_kabul_edilir(int minAge, int maxAge, int age)
    {
        Assert.Null(EventEligibilityRules.CheckAge(minAge, maxAge, age));
    }

    [Fact]
    public void Alt_yas_sinirinin_altindaki_kisi_reddedilir()
    {
        var violation = EventEligibilityRules.CheckAge(18, 25, 17);

        Assert.NotNull(violation);
        Assert.Equal("AGE_NOT_ELIGIBLE", violation.ErrorCode);
        Assert.Equal("En az 18 yaş şartı", violation.ShortReason);
    }

    [Fact]
    public void Ust_yas_sinirinin_ustundeki_kisi_reddedilir()
    {
        var violation = EventEligibilityRules.CheckAge(18, 25, 26);

        Assert.NotNull(violation);
        Assert.Equal("AGE_NOT_ELIGIBLE", violation.ErrorCode);
        Assert.Equal("En fazla 25 yaş şartı", violation.ShortReason);
    }

    [Fact]
    public void Yas_siniri_sifirsa_sinirsiz_kabul_edilir()
    {
        Assert.Null(EventEligibilityRules.CheckAge(0, 0, 0));
        Assert.Null(EventEligibilityRules.CheckAge(0, 0, 120));
    }

    [Theory]
    [InlineData("2000-08-02", 26)]
    [InlineData("2000-08-03", 25)]
    [InlineData("1971-01-01", 55)]
    public void Yas_dogum_gunune_gore_hesaplanir(string birth, int expected)
    {
        var today = new DateTime(2026, 8, 2);

        Assert.Equal(expected, EventEligibilityRules.AgeAt(DateTime.Parse(birth), today));
    }
}
