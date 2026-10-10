namespace Nexora.Application.Common;

public static class TcKimlikValidator
{
    public static bool IsValid(string? tckn)
    {
        if (string.IsNullOrWhiteSpace(tckn) || tckn.Length != 11 || tckn[0] == '0')
            return false;

        if (!tckn.All(char.IsDigit))
            return false;

        var d = tckn.Select(c => c - '0').ToArray();
        var oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
        var evenSum = d[1] + d[3] + d[5] + d[7];

        var tenth = ((oddSum * 7) - evenSum) % 10;
        if (tenth < 0) tenth += 10;
        if (tenth != d[9]) return false;

        var eleventh = d.Take(10).Sum() % 10;
        return eleventh == d[10];
    }
}
