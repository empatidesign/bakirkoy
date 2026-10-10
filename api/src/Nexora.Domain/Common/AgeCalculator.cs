namespace Nexora.Domain.Common;

public static class AgeCalculator
{
    public const int MinorAgeThreshold = 18;

    public static int At(DateTime birthDate, DateTime today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.Date.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    public static int Today(DateTime birthDate) => At(birthDate, TurkeyTime.TodayDate());

    public static bool IsMinor(DateTime birthDate) => Today(birthDate) < MinorAgeThreshold;

    public static bool IsMinor(DateTime? birthDate) => birthDate.HasValue && IsMinor(birthDate.Value);
}
