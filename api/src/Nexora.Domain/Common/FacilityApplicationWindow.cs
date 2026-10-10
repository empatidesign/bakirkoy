namespace Nexora.Domain.Common;

public static class FacilityApplicationWindow
{
    public const string NotOpenCode = "APPLICATION_NOT_OPEN";
    public const string ClosedCode = "APPLICATION_CLOSED";
    public const string PeriodEndedCode = "PERIOD_ENDED";

    public const string NotOpenMessage = "Bu program için başvurular henüz açılmadı.";
    public const string ClosedMessage = "Bu program için başvuru süresi sona erdi.";
    public const string PeriodEndedMessage = "Bu programın dönemi sona ermiş.";

    public static bool IsExemptType(string? type)
        => string.Equals(type, "akademi", StringComparison.OrdinalIgnoreCase);

    public static (string Code, string Message)? Check(
        string? type,
        DateTime? applicationStartDate,
        DateTime? applicationEndDate,
        DateTime? periodStart,
        DateTime? periodEnd,
        string? periodType,
        int periodMonths,
        DateTime today)
    {
        if (periodEnd.HasValue && periodEnd.Value.Date < today)
            return (PeriodEndedCode, PeriodEndedMessage);

        if (IsExemptType(type))
            return null;

        if (applicationStartDate.HasValue && applicationStartDate.Value.Date > today)
            return (NotOpenCode, NotOpenMessage);

        if (applicationEndDate.HasValue && applicationEndDate.Value.Date < today)
            return (ClosedCode, ClosedMessage);

        return null;
    }
}
