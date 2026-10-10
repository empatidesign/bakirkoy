using Nexora.Application.Features.Facilities;
using Xunit;

namespace Nexora.UnitTests.Application;

public class FacilityCrossProgramRuleTests
{
    [Fact]
    public void Parse_null_veya_bos_devre_disi_doner()
    {
        var r1 = FacilityCrossProgramRule.Parse(null);
        Assert.False(r1.SameBranchCrossFacilityBlocked);
        Assert.Equal(0, r1.YearlyMaxApplicationsTotal);

        var r2 = FacilityCrossProgramRule.Parse("");
        Assert.False(r2.SameBranchCrossFacilityBlocked);
        Assert.Equal(0, r2.YearlyMaxApplicationsTotal);
    }

    [Fact]
    public void Parse_gecersiz_json_devre_disi_doner()
    {
        var r = FacilityCrossProgramRule.Parse("not-json");
        Assert.False(r.SameBranchCrossFacilityBlocked);
        Assert.Equal(0, r.YearlyMaxApplicationsTotal);
    }

    [Fact]
    public void Parse_her_iki_alani_dogru_okur()
    {
        var r = FacilityCrossProgramRule.Parse(
            "{\"crossFacilitySameBranchBlocked\":true,\"crossFacilityYearlyMaxApplications\":2}");
        Assert.True(r.SameBranchCrossFacilityBlocked);
        Assert.Equal(2, r.YearlyMaxApplicationsTotal);
    }

    [Fact]
    public void Parse_sadece_bloke_acik_yillik_sinir_kapali()
    {
        var r = FacilityCrossProgramRule.Parse("{\"crossFacilitySameBranchBlocked\":true}");
        Assert.True(r.SameBranchCrossFacilityBlocked);
        Assert.Equal(0, r.YearlyMaxApplicationsTotal);
    }

    [Fact]
    public void Parse_sadece_yillik_sinir_acik_bloke_kapali()
    {
        var r = FacilityCrossProgramRule.Parse("{\"crossFacilityYearlyMaxApplications\":2}");
        Assert.False(r.SameBranchCrossFacilityBlocked);
        Assert.Equal(2, r.YearlyMaxApplicationsTotal);
    }

    [Fact]
    public void Parse_false_degeri_acikca_devre_disi_birakir()
    {
        var r = FacilityCrossProgramRule.Parse("{\"crossFacilitySameBranchBlocked\":false,\"crossFacilityYearlyMaxApplications\":0,\"crossFacilitySameCategoryBlocked\":false}");
        Assert.False(r.SameBranchCrossFacilityBlocked);
        Assert.Equal(0, r.YearlyMaxApplicationsTotal);
        Assert.False(r.SameCategoryBlocked);
    }

    [Fact]
    public void Parse_kategori_engeli_varsayilan_acik_okunur()
    {
        var r = FacilityCrossProgramRule.Parse("{\"crossFacilitySameBranchBlocked\":true}");
        Assert.True(r.SameCategoryBlocked);
    }
}
