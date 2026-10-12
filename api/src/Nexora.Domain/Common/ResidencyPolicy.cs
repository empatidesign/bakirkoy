using Nexora.Domain.Entities.Participants;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Common;

public static class ResidencyPolicy
{
    public const string DefaultBakirkoyDistrictCode = "1166";
    public const string DefaultSultangaziDistrictCode = "1166";
    private const string BakirkoyNameFallback = "bakirkoy";

    public static bool IsMeaningfulDistrictCode(string? ilceKodu)
        => !string.IsNullOrWhiteSpace(ilceKodu)
           && !(int.TryParse(ilceKodu, out var parsed) && parsed <= 0);

    public static bool IsSultangaziResident(Participant participant, string? sultangaziDistrictCode = null)
    {
        var code = string.IsNullOrWhiteSpace(sultangaziDistrictCode) ? DefaultBakirkoyDistrictCode : sultangaziDistrictCode;

        if (IsMeaningfulDistrictCode(participant.IlceKodu))
            return participant.IlceKodu == code;

        if (!string.IsNullOrWhiteSpace(participant.District))
            return MentionsBakirkoy(participant.District);

        return !string.IsNullOrWhiteSpace(participant.Address) && MentionsBakirkoy(participant.Address);
    }

    // NVI adresleri büyük harfle gelir ("BAKIRKÖY"); invariant lower "bakirköy" verir.
    // tr-TR ile küçültüp ı/ö'yü sadeleştirerek tüm yazımları tek forma indiriyoruz.
    private static bool MentionsBakirkoy(string text)
        => text.ToLower(System.Globalization.CultureInfo.GetCultureInfo("tr-TR"))
               .Replace('ı', 'i').Replace('ö', 'o')
               .Contains(BakirkoyNameFallback, StringComparison.Ordinal);

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
