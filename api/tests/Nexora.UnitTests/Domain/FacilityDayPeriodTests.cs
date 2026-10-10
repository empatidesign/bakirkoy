using Nexora.Domain.Entities.Facilities;
using Xunit;
namespace Nexora.UnitTests.Domain;
public class FacilityDayPeriodTests
{
    [Theory]
    [InlineData(1, 21, 9)]
    [InlineData(15, 5, 10)]
    public void DailyProgramIncludesItsFirstDay(int days, int endDay, int endMonth)
    {
        var start = new DateTime(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);
        var data = new FacilityGroupData("sports", Guid.NewGuid(), Guid.NewGuid(), null,
            "Program Test", "kurs", "mixed", 20, 5, 18, 0, "[]", "full", "{}", "{}",
            start, null, 3, 2, 15, null, null, true, null, "fixed", 1, 0,
            start, null, false, true, true, "unlimited", 0, "day", days);
        var group = FacilityGroup.Create(data, null);
        Assert.Equal(new DateTime(2026, endMonth, endDay, 0, 0, 0, DateTimeKind.Utc), group.PeriodEnd);
        group.Update(data with { PeriodDays = 1 }, null);
        Assert.Equal(start, group.PeriodEnd);
    }
}
