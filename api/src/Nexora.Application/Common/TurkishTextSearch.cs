using System.Globalization;

namespace Nexora.Application.Common;

public static class TurkishTextSearch
{
    private static readonly CultureInfo TrTr = CultureInfo.GetCultureInfo("tr-TR");

    public static bool ContainsIgnoreCaseTr(this string? haystack, string? needle)
    {
        if (string.IsNullOrEmpty(haystack) || string.IsNullOrEmpty(needle))
            return false;

        return TrTr.CompareInfo.IndexOf(haystack, needle, CompareOptions.IgnoreCase) >= 0;
    }
}
