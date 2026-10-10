using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Common;

public static class ResidencyPolicy
{
    public const string DefaultBakirkoyDistrictCode = "1166";
    public const string DefaultSultangaziDistrictCode = "1166";
    private const string BakirkoyNameFallback = "bakirkoy";
    private const string BakirkoyTrNameFallback = "bakırköy";
    private const string SultangaziNameFallback = "sultangazi";

    public static bool IsMeaningfulDistrictCode(string? ilceKodu)
        => !string.IsNullOrWhiteSpace(ilceKodu)
           && !(int.TryParse(ilceKodu, out var parsed) && parsed <= 0);

    public static bool IsSultangaziResident(Participant participant, string? sultangaziDistrictCode = null)
    {
        var code = string.IsNullOrWhiteSpace(sultangaziDistrictCode) ? DefaultBakirkoyDistrictCode : sultangaziDistrictCode;

        if (IsMeaningfulDistrictCode(participant.IlceKodu))
            return participant.IlceKodu == code || participant.IlceKodu == "1166";

        if (!string.IsNullOrWhiteSpace(participant.District))
            return participant.District.Contains(BakirkoyNameFallback, StringComparison.OrdinalIgnoreCase)
                || participant.District.Contains(BakirkoyTrNameFallback, StringComparison.OrdinalIgnoreCase)
                || participant.District.Contains(SultangaziNameFallback, StringComparison.OrdinalIgnoreCase);

        return !string.IsNullOrWhiteSpace(participant.Address)
            && (participant.Address.Contains(BakirkoyNameFallback, StringComparison.OrdinalIgnoreCase)
                || participant.Address.Contains(BakirkoyTrNameFallback, StringComparison.OrdinalIgnoreCase)
                || participant.Address.Contains(SultangaziNameFallback, StringComparison.OrdinalIgnoreCase));
    }

    public static bool IsAllowed(ResidencyMode mode, Participant participant, string? sultangaziDistrictCode = null)
    {
        var resident = IsSultangaziResident(participant, sultangaziDistrictCode);
        return mode switch
        {
            ResidencyMode.SultangaziOnly => resident,
            ResidencyMode.OutsideOnly => !resident,
            _ => true,
        };
    }
}
