using Nexora.Domain.Entities.Facilities;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class FacilitySessionEligibilityTests
{
    private static readonly DateTime MStart = new(2026, 2, 15);
    private static readonly DateTime PEnd = new(2026, 5, 15);

    [Fact]
    public void Hak_baslangicindan_ONCE_seans_uygun_degil()
    {
        Assert.False(FacilitySessionEligibility.IsEligible(new DateTime(2026, 2, 10), MStart, PEnd, false),
            "yedekte beklerken/terfi öncesi seans devamsızlık yazmamalı (D05)");
    }

    [Fact]
    public void Hak_baslangici_gunu_ve_sonrasi_uygun()
    {
        Assert.True(FacilitySessionEligibility.IsEligible(new DateTime(2026, 2, 15), MStart, PEnd, false));
        Assert.True(FacilitySessionEligibility.IsEligible(new DateTime(2026, 3, 1), MStart, PEnd, false));
    }

    [Fact]
    public void Hak_bitisinden_sonra_uygun_degil()
    {
        Assert.False(FacilitySessionEligibility.IsEligible(new DateTime(2026, 5, 16), MStart, PEnd, false));
        Assert.True(FacilitySessionEligibility.IsEligible(new DateTime(2026, 5, 15), MStart, PEnd, false));
    }

    [Fact]
    public void Iptal_seans_uygun_degil()
    {
        Assert.False(FacilitySessionEligibility.IsEligible(new DateTime(2026, 3, 1), MStart, PEnd, true));
    }

    [Fact]
    public void MembershipStart_yoksa_alt_sinir_uygulanmaz()
    {
        Assert.True(FacilitySessionEligibility.IsEligible(new DateTime(2020, 1, 1), null, null, false));
    }
}
