using Nexora.Domain.Entities.Events;
using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Common;

public sealed record EventEligibilityViolation(string ErrorCode, string Message, string ShortReason);

public static class EventEligibilityRules
{
    public static int AgeAt(DateTime birthDate, DateTime today)
    {
        var age = today.Year - birthDate.Year;
        if (birthDate.Date > today.AddYears(-age)) age--;
        return age < 0 ? 0 : age;
    }

    public static EventEligibilityViolation? CheckGender(string? eventGender, Gender participantGender, bool requireGenderMatch)
    {
        if (!requireGenderMatch) return null;
        if (eventGender is not ("male" or "female")) return null;

        var code = participantGender.ToCode();
        if (eventGender == code) return null;

        if (code == GenderExtensions.UnknownCode)
            return new EventEligibilityViolation("GENDER_NOT_ELIGIBLE",
                "Cinsiyet bilginiz kayıtlı olmadığı için bu etkinliğe başvurulamıyor. Lütfen profil bilgilerinizi güncelleyin.",
                "Cinsiyet bilgisi eksik");

        return new EventEligibilityViolation("GENDER_NOT_ELIGIBLE",
            eventGender == "male"
                ? "Bu etkinlik erkek katılımcılar içindir."
                : "Bu etkinlik kadın katılımcılar içindir.",
            eventGender == "male" ? "Yalnızca erkek katılımcılar" : "Yalnızca kadın katılımcılar");
    }

    public static EventEligibilityViolation? CheckAge(int minAge, int maxAge, int age)
    {
        if (minAge > 0 && age < minAge)
            return new EventEligibilityViolation("AGE_NOT_ELIGIBLE",
                "Katılımcı bu etkinliğin yaş aralığı dışında.", $"En az {minAge} yaş şartı");

        if (maxAge > 0 && age > maxAge)
            return new EventEligibilityViolation("AGE_NOT_ELIGIBLE",
                "Katılımcı bu etkinliğin yaş aralığı dışında.", $"En fazla {maxAge} yaş şartı");

        return null;
    }

    public static EventEligibilityViolation? CheckResidency(
        ResidencyMode residencyMode, Participant participant, string? sultangaziDistrictCode)
    {
        if (ResidencyPolicy.IsAllowed(residencyMode, participant, sultangaziDistrictCode)) return null;

        return residencyMode == ResidencyMode.OutsideOnly
            ? new EventEligibilityViolation("RESIDENCY_NOT_ELIGIBLE",
                "Bu etkinlik yalnızca Sultangazi dışı sakinlere açıktır.", "Yalnızca Sultangazi dışı sakinleri")
            : new EventEligibilityViolation("RESIDENCY_NOT_ELIGIBLE",
                "Bu etkinlik yalnızca Sultangazi sakinlerine açıktır.", "Yalnızca Sultangazi sakinleri");
    }

    public static EventEligibilityViolation? CheckResidencyFull(
        string residencyMode, Participant participant, string? tckn, string? sultangaziDistrictCode)
    {
        var violation = EligibilityRules.CheckResidency(residencyMode, participant, tckn, sultangaziDistrictCode);
        return violation is null ? null : new EventEligibilityViolation(violation.ErrorCode, violation.Message, violation.Message);
    }

    public static EventEligibilityViolation? CheckAll(
        Event ev, Participant participant, ResidencyMode residencyMode, DateTime today,
        string? sultangaziDistrictCode, bool requireGenderMatch)
        => CheckGender(ev.Gender, participant.Gender, requireGenderMatch)
           ?? CheckAge(ev.MinAge, ev.MaxAge, AgeAt(participant.BirthDate, today))
           ?? CheckResidency(residencyMode, participant, sultangaziDistrictCode);

    public static EventEligibilityViolation? CheckAllFull(
        Event ev, Participant participant, string? tckn, DateTime today,
        string? sultangaziDistrictCode, bool requireGenderMatch)
        => CheckGender(ev.Gender, participant.Gender, requireGenderMatch)
           ?? CheckAge(ev.MinAge, ev.MaxAge, AgeAt(participant.BirthDate, today))
           ?? CheckResidencyFull(ev.ResidencyMode, participant, tckn, sultangaziDistrictCode);
}
