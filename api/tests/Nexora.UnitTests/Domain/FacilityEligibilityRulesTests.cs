using Nexora.Domain.Common;
using Nexora.Domain.Enums;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class FacilityEligibilityRulesTests
{
    private static readonly DateTime Today = new(2026, 8, 2);

    [Theory]
    [InlineData("mixed", Gender.Male)]
    [InlineData("mixed", Gender.Female)]
    [InlineData("male", Gender.Male)]
    [InlineData("female", Gender.Female)]
    public void Uygun_cinsiyet_kabul_edilir(string groupGender, Gender participantGender)
    {
        Assert.Null(FacilityEligibilityRules.CheckGender(groupGender, participantGender));
    }

    [Fact]
    public void Kadin_grubuna_erkek_reddedilir()
    {
        var violation = FacilityEligibilityRules.CheckGender("female", Gender.Male);

        Assert.NotNull(violation);
        Assert.Equal("GENDER_NOT_ELIGIBLE", violation.ErrorCode);
        Assert.Contains("kadın", violation.Message);
    }

    [Fact]
    public void Erkek_grubuna_kadin_reddedilir()
    {
        var violation = FacilityEligibilityRules.CheckGender("male", Gender.Female);

        Assert.NotNull(violation);
        Assert.Equal("GENDER_NOT_ELIGIBLE", violation.ErrorCode);
    }

    [Fact]
    public void Cinsiyeti_bilinmeyen_kisi_kadin_grubunda_reddedilir()
    {
        Assert.NotNull(FacilityEligibilityRules.CheckGender("female", Gender.Unknown));
    }

    [Theory]
    [InlineData(18, 25, 18)]
    [InlineData(18, 25, 25)]
    [InlineData(18, 25, 22)]
    [InlineData(0, 0, 55)]
    [InlineData(0, 25, 5)]
    [InlineData(18, 0, 90)]
    public void Yas_araliginda_olan_kabul_edilir(int min, int max, int age)
    {
        Assert.Null(FacilityEligibilityRules.CheckAge(min, max, age));
    }

    [Theory]
    [InlineData(18, 25, 17)]
    [InlineData(18, 25, 26)]
    [InlineData(18, 25, 55)]
    [InlineData(18, 0, 17)]
    [InlineData(0, 25, 26)]
    public void Yas_araliginin_disi_reddedilir(int min, int max, int age)
    {
        var violation = FacilityEligibilityRules.CheckAge(min, max, age);

        Assert.NotNull(violation);
        Assert.Equal("AGE_NOT_ELIGIBLE", violation.ErrorCode);
    }

    [Fact]
    public void Dogum_gunu_gelmemisse_yas_bir_eksik_sayilir()
    {
        Assert.Equal(17, FacilityEligibilityRules.AgeAt(new DateTime(2008, 12, 31), Today));
        Assert.Equal(18, FacilityEligibilityRules.AgeAt(new DateTime(2008, 8, 2), Today));
        Assert.Equal(17, FacilityEligibilityRules.AgeAt(new DateTime(2008, 8, 3), Today));
    }

    [Fact]
    public void Gelecek_dogum_tarihi_negatif_yas_uretmez()
    {
        Assert.Equal(0, FacilityEligibilityRules.AgeAt(new DateTime(2030, 1, 1), Today));
    }

    [Theory]
    [InlineData("99123456789", true)]
    [InlineData("10103558834", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void Yabanci_kimlik_onekiyle_belirlenir(string? tckn, bool expected)
    {
        Assert.Equal(expected, FacilityEligibilityRules.IsForeign(tckn));
    }

    [Fact]
    public void Anyone_modunda_hicbir_ikamet_kisiti_uygulanmaz()
    {
        var participant = BuildParticipant(tckn: "10103558834", district: "Esenler");

        Assert.Null(FacilityEligibilityRules.CheckResidency("anyone", participant, participant.Tckn, "2055"));
    }

    [Fact]
    public void Sultangazi_only_ilce_disini_reddeder()
    {
        var outsider = BuildParticipant(tckn: "10103558834", district: "Esenler");
        var resident = BuildParticipant(tckn: "10103558834", district: "Bakırköy");

        var violation = FacilityEligibilityRules.CheckResidency("sultangazi_only", outsider, outsider.Tckn, "2055");
        Assert.NotNull(violation);
        Assert.Equal("RESIDENCY_NOT_ELIGIBLE", violation.ErrorCode);

        Assert.Null(FacilityEligibilityRules.CheckResidency("sultangazi_only", resident, resident.Tckn, "2055"));
    }

    [Fact]
    public void Foreign_only_tc_vatandasini_reddeder()
    {
        var tc = BuildParticipant(tckn: "10103558834", district: "Bakırköy");
        var foreign = BuildParticipant(tckn: "99123456789", district: "Bakırköy");

        Assert.NotNull(FacilityEligibilityRules.CheckResidency("foreign_only", tc, tc.Tckn, "2055"));
        Assert.Null(FacilityEligibilityRules.CheckResidency("foreign_only", foreign, foreign.Tckn, "2055"));
    }

    [Fact]
    public void Tc_only_yabanciyi_reddeder()
    {
        var foreign = BuildParticipant(tckn: "99123456789", district: "Bakırköy");
        var tc = BuildParticipant(tckn: "10103558834", district: "Bakırköy");

        Assert.NotNull(FacilityEligibilityRules.CheckResidency("tc_only", foreign, foreign.Tckn, "2055"));
        Assert.Null(FacilityEligibilityRules.CheckResidency("tc_only", tc, tc.Tckn, "2055"));
    }

    [Fact]
    public void Sultangazi_tc_iki_ekseni_birlikte_arar()
    {
        var ok = BuildParticipant(tckn: "10103558834", district: "Bakırköy");
        var disariTc = BuildParticipant(tckn: "10103558834", district: "Esenler");
        var icerideYabanci = BuildParticipant(tckn: "99123456789", district: "Bakırköy");

        Assert.Null(FacilityEligibilityRules.CheckResidency("sultangazi_tc", ok, ok.Tckn, "2055"));
        Assert.NotNull(FacilityEligibilityRules.CheckResidency("sultangazi_tc", disariTc, disariTc.Tckn, "2055"));
        Assert.NotNull(FacilityEligibilityRules.CheckResidency("sultangazi_tc", icerideYabanci, icerideYabanci.Tckn, "2055"));
    }

    [Fact]
    public void Sultangazi_foreign_iki_ekseni_birlikte_arar()
    {
        var ok = BuildParticipant(tckn: "99123456789", district: "Bakırköy");
        var disaridaYabanci = BuildParticipant(tckn: "99123456789", district: "Esenler");
        var icerideTc = BuildParticipant(tckn: "10103558834", district: "Bakırköy");

        Assert.Null(FacilityEligibilityRules.CheckResidency("sultangazi_foreign", ok, ok.Tckn, "2055"));
        Assert.NotNull(FacilityEligibilityRules.CheckResidency("sultangazi_foreign", disaridaYabanci, disaridaYabanci.Tckn, "2055"));
        Assert.NotNull(FacilityEligibilityRules.CheckResidency("sultangazi_foreign", icerideTc, icerideTc.Tckn, "2055"));
    }

    [Fact]
    public void Taninmayan_mod_kisit_uygulamaz()
    {
        var participant = BuildParticipant(tckn: "10103558834", district: "Esenler");

        Assert.Null(FacilityEligibilityRules.CheckResidency("bilinmeyen_mod", participant, participant.Tckn, "2055"));
    }

    [Theory]
    [InlineData("sultangazi_only", "10103558834")]
    [InlineData("sultangazi_tc", "10103558834")]
    [InlineData("sultangazi_foreign", "99123456789")]
    public void Anlamsiz_ilce_kodu_tesis_ikamet_modlarinda_da_dusurulur(string mode, string tckn)
    {
        var p = BuildParticipant(tckn, district: "Bakırköy", ilceKodu: "0");

        Assert.Null(FacilityEligibilityRules.CheckResidency(mode, p, p.Tckn, "2055"));
    }

    [Fact]
    public void Anlamsiz_ilce_kodu_ilce_disini_sakin_yapmaz()
    {
        var p = BuildParticipant("10103558834", district: "Esenler", ilceKodu: "0");

        Assert.NotNull(FacilityEligibilityRules.CheckResidency("sultangazi_only", p, p.Tckn, "2055"));
    }

    private static Nexora.Domain.Entities.Participants.Participant BuildParticipant(
        string tckn, string district, string? ilceKodu = null)
    {
        var participant = Nexora.Domain.Entities.Participants.Participant.Create(
            tckn, "Test Kisi", new DateTime(1971, 1, 1), Gender.Male, false,
            "hash", null, "05001112233", null, null, null);

        participant.ApplyStructuredAddress(
            $"{district} mah.", "İstanbul", district, null,
            ilceKodu ?? (district.Equals("Bakırköy", StringComparison.OrdinalIgnoreCase) ? "2055" : "1001"));

        return participant;
    }
}
