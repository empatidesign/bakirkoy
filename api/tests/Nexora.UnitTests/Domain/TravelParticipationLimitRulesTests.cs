using Nexora.Domain.Common;
using Xunit;

namespace Nexora.UnitTests.Domain;

public class TravelParticipationLimitRulesTests
{
    [Theory]
    [InlineData("unlimited", false, true)]
    [InlineData("none", true, true)]
    [InlineData("weekly", true, true)]
    [InlineData("none", false, false)]
    [InlineData("weekly", false, false)]
    [InlineData("yearly", false, false)]
    public void IsExempt_dogru_calisir(string period, bool exemptFlag, bool expected)
    {
        Assert.Equal(expected, TravelParticipationLimitRules.IsExempt(period, exemptFlag));
    }

    [Theory]
    [InlineData(0, true, false)]
    [InlineData(0, false, true)]
    [InlineData(1, true, false)]
    [InlineData(1, false, false)]
    [InlineData(2, false, false)]
    public void IsExemptAsVehicleFree_dogru_calisir(int busCount, bool applyToVehicleFreeTravels, bool expected)
    {
        Assert.Equal(expected, TravelParticipationLimitRules.IsExemptAsVehicleFree(busCount, applyToVehicleFreeTravels));
    }
}
