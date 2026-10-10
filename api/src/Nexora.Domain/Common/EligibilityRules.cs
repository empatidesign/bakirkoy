using Nexora.Domain.Entities.Participants;

namespace Nexora.Domain.Common;

public sealed record EligibilityViolation(string ErrorCode, string Message);

public static class EligibilityRules
{
    public const string ForeignTcknPrefix = "99";

    public static readonly string[] ValidResidencyModes =
        ["anyone", "sultangazi_only", "outside_only", "foreign_only", "tc_only", "sultangazi_tc", "sultangazi_foreign"];

    public static bool IsForeign(string? tckn)
        => !string.IsNullOrWhiteSpace(tckn) && tckn.StartsWith(ForeignTcknPrefix, StringComparison.Ordinal);

    public static string NormalizeResidencyMode(string? mode)
        => !string.IsNullOrWhiteSpace(mode) && ValidResidencyModes.Contains(mode) ? mode : "anyone";

    public static EligibilityViolation? CheckResidency(
        string residencyMode, Participant participant, string? tckn, string? sultangaziDistrictCode)
    {
        var isForeign = IsForeign(tckn ?? participant.Tckn);
        var isSultangazi = ResidencyPolicy.IsSultangaziResident(participant, sultangaziDistrictCode);
        return CheckResidencyRaw(residencyMode, isSultangazi, isForeign);
    }

    public static EligibilityViolation? CheckResidencyRaw(string residencyMode, bool isSultangazi, bool isForeign)
    {
        if (string.IsNullOrWhiteSpace(residencyMode) || residencyMode == "anyone") return null;

        var (requireSultangazi, requireOutside, citizenshipRequirement) = residencyMode switch
        {
            "sultangazi_only" => (true, false, (bool?)null),
            "outside_only" => (false, true, (bool?)null),
            "foreign_only" => (false, false, true),
            "tc_only" => (false, false, false),
            "sultangazi_tc" => (true, false, false),
            "sultangazi_foreign" => (true, false, true),
            _ => (false, false, (bool?)null),
        };

        if (requireSultangazi && !isSultangazi)
            return new EligibilityViolation("RESIDENCY_NOT_ELIGIBLE",
                "Bu hizmet yalnızca Sultangazi'de ikamet edenler içindir.");
        if (requireOutside && isSultangazi)
            return new EligibilityViolation("RESIDENCY_NOT_ELIGIBLE",
                "Bu hizmet yalnızca Sultangazi dışında ikamet edenler içindir.");
        if (citizenshipRequirement == true && !isForeign)
            return new EligibilityViolation("RESIDENCY_NOT_ELIGIBLE",
                "Bu hizmet yalnızca yabancı uyruklu katılımcılar içindir.");
        if (citizenshipRequirement == false && isForeign)
            return new EligibilityViolation("RESIDENCY_NOT_ELIGIBLE",
                "Bu hizmet yalnızca T.C. vatandaşları içindir.");

        return null;
    }
}
