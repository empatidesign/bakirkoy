using System.Globalization;

namespace Nexora.Domain.Common;

public static class TextCasing
{
    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

    public static string CapitalizeFirstLetters(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return text ?? "";
        var chars = text.Trim().ToCharArray();
        var atWordStart = true;
        for (var i = 0; i < chars.Length; i++)
        {
            if (char.IsWhiteSpace(chars[i]))
            {
                atWordStart = true;
                continue;
            }
            if (atWordStart && char.IsLower(chars[i]))
                chars[i] = char.ToUpper(chars[i], Turkish);
            atWordStart = false;
        }
        return new string(chars);
    }
}
