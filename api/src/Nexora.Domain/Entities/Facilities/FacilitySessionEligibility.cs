namespace Nexora.Domain.Entities.Facilities;

public static class FacilitySessionEligibility
{
    public static bool IsEligible(DateTime sessionDate, DateTime? membershipStart, DateTime? periodEnd, bool sessionCancelled)
    {
        if (sessionCancelled) return false;
        var d = sessionDate.Date;
        if (membershipStart.HasValue && d < membershipStart.Value.Date) return false;
        if (periodEnd.HasValue && d > periodEnd.Value.Date) return false;
        return true;
    }
}
