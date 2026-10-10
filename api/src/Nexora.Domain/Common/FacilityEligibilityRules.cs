using Nexora.Domain.Entities.Facilities;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Common;

public sealed record FacilityEligibilityViolation(string ErrorCode, string Message);

public static class FacilityEligibilityRules
{
    public const string ForeignTcknPrefix = "99";

    public static bool IsForeign(string? tckn)
        => !string.IsNullOrWhiteSpace(tckn) && tckn.StartsWith(ForeignTcknPrefix, StringComparison.Ordinal);

    public static int AgeAt(DateTime birthDate, DateTime today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    public static FacilityEligibilityViolation? CheckGender(string groupGender, Gender participantGender)
    {
        if (string.IsNullOrWhiteSpace(groupGender) || groupGender == "mixed") return null;

        var value = participantGender switch
        {
            Gender.Male => "male",
            Gender.Female => "female",
            _ => null,
        };
        if (value is not null && groupGender == value) return null;

        return new FacilityEligibilityViolation("GENDER_NOT_ELIGIBLE",
            groupGender == "male"
                ? "Bu program yalnızca erkek katılımcılar içindir."
                : "Bu program yalnızca kadın katılımcılar içindir.");
    }

    public static FacilityEligibilityViolation? CheckAge(int ageMin, int ageMax, int age)
    {
        if ((ageMin > 0 && age < ageMin) || (ageMax > 0 && age > ageMax))
        {
            var msg = ageMax == 0
                ? $"Bu program {ageMin} yaş ve üzeri içindir."
                : ageMin == 0
                ? $"Bu program en fazla {ageMax} yaş içindir."
                : $"Bu program {ageMin}-{ageMax} yaş aralığı içindir.";
            return new FacilityEligibilityViolation("AGE_NOT_ELIGIBLE", msg);
        }

        return null;
    }

    public static FacilityEligibilityViolation? CheckResidency(
        string residencyMode, Participant participant, string? tckn, string? sultangaziDistrictCode)
    {
        var violation = EligibilityRules.CheckResidency(residencyMode, participant, tckn, sultangaziDistrictCode);
        return violation is null ? null : new FacilityEligibilityViolation(violation.ErrorCode, violation.Message);
    }

    public static FacilityEligibilityViolation? CheckAll(
        FacilityGroup group, Participant participant, string? tckn, DateTime today, string? sultangaziDistrictCode)
        => CheckGender(group.Gender, participant.Gender)
           ?? CheckAge(group.AgeMin, group.AgeMax, AgeAt(participant.BirthDate, today))
           ?? CheckResidency(group.ResidencyMode, participant, tckn, sultangaziDistrictCode);
}
