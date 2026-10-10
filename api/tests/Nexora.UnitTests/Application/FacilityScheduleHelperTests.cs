using Nexora.Application.Features.Facilities;
using Xunit;

namespace Nexora.UnitTests.Application;

public class FacilityScheduleHelperTests
{
    private const string ArrayShape = """[{"day":"monday","startTime":"10:00","endTime":"11:00"}]""";
    private const string ObjectShape = """{"slots":[{"day":"monday","startTime":"10:00","endTime":"11:00"}]}""";
    private const string ObjectShapeUpper = """{"Slots":[{"day":"monday","startTime":"10:00","endTime":"11:00"}]}""";

    [Theory]
    [InlineData(ArrayShape)]
    [InlineData(ObjectShape)]
    [InlineData(ObjectShapeUpper)]
    public void ParseSlots_ReadsBothArrayAndSlotsObjectShapes(string json)
    {
        var slots = FacilityScheduleHelper.ParseSlots(json);
        Assert.Single(slots);
        Assert.Equal("monday", slots[0].Day);
        Assert.Equal("10:00", slots[0].StartTime);
        Assert.Equal("11:00", slots[0].EndTime);
    }

    [Theory]
    [InlineData(ArrayShape)]
    [InlineData(ObjectShape)]
    public void ParseDays_ReadsBothShapes(string json)
    {
        var days = FacilityScheduleHelper.ParseDays(json);
        Assert.Equal([DayOfWeek.Monday], days);
    }

    [Theory]
    [InlineData(ArrayShape, ObjectShape)]
    [InlineData(ObjectShape, ObjectShape)]
    [InlineData(ObjectShape, ArrayShape)]
    public void SlotsOverlap_DetectsConflictAcrossMixedShapes(string a, string b)
        => Assert.True(FacilityScheduleHelper.SlotsOverlap(a, b));

    [Fact]
    public void FindOverlap_CakisanGunVeSaatiMesajIcinDoner()
    {
        // Mevcut kayıt 10:30-11:30 ise kişiye gösterilecek saat KARŞI tarafın saatidir.
        const string other = """{"slots":[{"day":"monday","startTime":"10:30","endTime":"11:30"}]}""";
        var overlap = FacilityScheduleHelper.FindOverlap(ArrayShape, other);

        Assert.NotNull(overlap);
        Assert.Equal(DayOfWeek.Monday, overlap!.Day);
        Assert.Equal("Pazartesi 10:30-11:30", overlap.Describe());
    }

    [Fact]
    public void FindOverlap_CakismaYoksaNullDoner()
    {
        const string evening = """{"slots":[{"day":"monday","startTime":"20:00","endTime":"21:00"}]}""";
        Assert.Null(FacilityScheduleHelper.FindOverlap(ObjectShape, evening));
    }

    [Fact]
    public void SlotsOverlap_ObjectShapeSameDayDifferentHours_DoesNotConflict()
    {
        const string evening = """{"slots":[{"day":"monday","startTime":"20:00","endTime":"21:00"}]}""";
        Assert.False(FacilityScheduleHelper.SlotsOverlap(ObjectShape, evening));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("[]")]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("bozuk-json")]
    [InlineData("""{"slots":null}""")]
    [InlineData("""{"other":[{"day":"monday"}]}""")]
    public void ParseSlots_ReturnsEmptyForMissingOrMalformedSchedule(string json)
        => Assert.Empty(FacilityScheduleHelper.ParseSlots(json));
}
