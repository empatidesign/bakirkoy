namespace Nexora.Domain.Common;

public static class FacilityPeriods
{
    public static (DateTime Start, DateTime End) Bounds(DateTime periodStart, int months, int index)
    {
        var start = periodStart.Date;
        var i = index < 0 ? 0 : index;
        return (start.AddMonths(i * months), start.AddMonths((i + 1) * months));
    }

    public static int IndexAt(DateTime periodStart, int months, DateTime at)
    {
        if (months <= 0) return 0;
        var start = periodStart.Date;
        var target = at.Date;
        if (target <= start) return 0;

        var approx = ((target.Year - start.Year) * 12 + (target.Month - start.Month)) / months;
        var i = approx < 0 ? 0 : approx;
        while (i > 0 && start.AddMonths(i * months) > target) i--;
        while (start.AddMonths((i + 1) * months) <= target) i++;
        return i;
    }

    public static (DateTime Start, DateTime End, int Index) PeriodAt(DateTime periodStart, int months, DateTime at)
    {
        var idx = IndexAt(periodStart, months, at);
        var (start, end) = Bounds(periodStart, months, idx);
        return (start, end, idx);
    }

    public static IReadOnlyList<(int Index, DateTime Start, DateTime End)> Overlapping(DateTime periodStart, int months, DateTime rangeStart, DateTime rangeEnd)
    {
        var list = new List<(int, DateTime, DateTime)>();
        if (months <= 0 || rangeEnd <= rangeStart) return list;

        var floor = periodStart.Date;
        var idx = IndexAt(periodStart, months, rangeStart < floor ? floor : rangeStart);
        while (list.Count <= 1000)
        {
            var (start, end) = Bounds(periodStart, months, idx);
            if (start >= rangeEnd) break;
            if (rangeStart < end && rangeEnd > start) list.Add((idx, start, end));
            idx++;
        }
        return list;
    }

    public static DateTime RollingHorizon(DateTime periodStart, int months, DateTime asOf, int periodsAhead = 1)
    {
        if (months <= 0) return periodStart.Date;
        var floor = periodStart.Date;
        var curIdx = IndexAt(periodStart, months, asOf.Date < floor ? floor : asOf.Date);
        var ahead = periodsAhead < 0 ? 0 : periodsAhead;
        return Bounds(periodStart, months, curIdx + ahead).End;
    }
}
