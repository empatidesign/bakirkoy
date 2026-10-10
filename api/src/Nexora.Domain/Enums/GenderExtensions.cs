namespace Nexora.Domain.Enums;

public static class GenderExtensions
{
    public const string MaleCode = "male";
    public const string FemaleCode = "female";
    public const string UnknownCode = "unknown";

    public static string ToCode(this Gender gender) => gender switch
    {
        Gender.Male => MaleCode,
        Gender.Female => FemaleCode,
        _ => UnknownCode,
    };

    public static bool IsKnown(this Gender gender) => gender is Gender.Male or Gender.Female;
}
