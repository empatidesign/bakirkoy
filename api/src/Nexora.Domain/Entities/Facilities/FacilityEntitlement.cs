namespace Nexora.Domain.Entities.Facilities;

public static class FacilityEntitlementModel
{
    public const string PersonalDuration = "personal_duration";
    public const string FixedCalendar = "fixed_calendar";

    public static string DefaultFor(string? periodType)
        => string.Equals(periodType, "recurring", StringComparison.OrdinalIgnoreCase)
            ? PersonalDuration
            : FixedCalendar;

    public static string Normalize(string? value, string? periodType)
        => value switch
        {
            PersonalDuration => PersonalDuration,
            FixedCalendar => FixedCalendar,
            _ => DefaultFor(periodType),
        };
}

public readonly record struct EntitlementRange(DateTime Start, DateTime End);

public static class FacilityEntitlement
{
    public static EntitlementRange Compute(
        string? entitlementModel,
        DateTime effectiveStart,
        string? periodUnit,
        int periodMonths,
        int periodDays,
        DateTime? groupPeriodStart,
        DateTime? groupPeriodEnd)
    {
        var start = effectiveStart.Date;

        if (string.Equals(entitlementModel, FacilityEntitlementModel.FixedCalendar, StringComparison.OrdinalIgnoreCase))
        {
            var fixedStart = (groupPeriodStart ?? start).Date;
            var fixedEnd = (groupPeriodEnd ?? PersonalEnd(start, periodUnit, periodMonths, periodDays)).Date;
            return new EntitlementRange(fixedStart, fixedEnd);
        }

        return new EntitlementRange(start, PersonalEnd(start, periodUnit, periodMonths, periodDays));
    }

    private static DateTime PersonalEnd(DateTime start, string? periodUnit, int periodMonths, int periodDays)
    {
        if (string.Equals(periodUnit, "day", StringComparison.OrdinalIgnoreCase) && periodDays > 0)
            return start.AddDays(periodDays);
        if (periodMonths > 0)
            return start.AddMonths(periodMonths);
        if (periodDays > 0)
            return start.AddDays(periodDays);
        return start;
    }
}
