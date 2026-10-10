namespace Nexora.Domain.Common;

public static class TurkeyTime
{
    private static readonly TimeZoneInfo Tz = SafeFind();

    private static TimeZoneInfo SafeFind()
    {
        foreach (var id in new[] { "Europe/Istanbul", "Turkey Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }

    public static DateTime Now() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Tz);

    public static DateOnly Today() => DateOnly.FromDateTime(Now());

    public static DateTime TodayDate() => Today().ToDateTime(TimeOnly.MinValue);

    public static DateTime NowWallClock() => Now();

    public static DateTime TodayStartUtc() => ToUtc(TodayDate());

    public static DateTime ToUtc(DateTime turkeyWallClock)
        => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(turkeyWallClock, DateTimeKind.Unspecified), Tz);

    public static DateTime ToTurkey(DateTime utc)
        => TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Tz);
}
